import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getConfig } from "../lib/config.server";
import { fetchStockByWarehouse } from "../lib/inventory.server";
import { computePromise } from "../lib/engine";

// Storefront-facing endpoint, reached via Shopify App Proxy:
//   /apps/stockpromise/delivery?variant=123&emirate=Ajman  →  this route.
// Returns the live delivery promise (+ the zone list) for the theme widget.
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const variant = url.searchParams.get("variant");
  const emirate =
    url.searchParams.get("emirate") ?? url.searchParams.get("zone") ?? "";

  const config = await getConfig(session.shop);

  let stock: Record<string, number> = {};
  if (admin && variant) {
    const gid = variant.startsWith("gid://")
      ? variant
      : `gid://shopify/ProductVariant/${variant}`;
    try {
      stock = await fetchStockByWarehouse(admin, gid, config);
    } catch {
      // If inventory can't be read, engine treats it as no stock (safe).
    }
  }

  const result = computePromise({
    config,
    stockByWarehouse: stock,
    location: { emirate },
    now: new Date(),
  });

  // The widget uses this to build its area selector.
  const zones = (config.zones ?? []).map((z) => ({ id: z.id, name: z.name }));

  return new Response(JSON.stringify({ ...result, zones }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

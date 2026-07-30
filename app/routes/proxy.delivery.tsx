import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getConfig } from "../lib/config.server";
import { fetchStockByWarehouse } from "../lib/inventory.server";
import { computePromise } from "../lib/engine";

// Storefront-facing endpoint, reached via Shopify App Proxy
// (e.g. /apps/stockpromise/delivery?variant=123&emirate=Ajman).
// Returns the live delivery promise JSON for the theme widget to render.
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
      // If inventory can't be read, fall through — engine will treat as no stock.
    }
  }

  const result = computePromise({
    config,
    stockByWarehouse: stock,
    location: { emirate },
    now: new Date(),
  });

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

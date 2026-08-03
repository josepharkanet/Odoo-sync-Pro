import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";
import { pushOrderToOdoo, type ShopifyLine } from "../lib/odoo-sync.server";

// New Shopify order → create the matching sale.order in Odoo.
// The raw webhook payload carries `sku` but not `barcode`, so we look barcodes
// up from the line items' variant ids (Elixir matches products by barcode).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const order: any = payload;

  try {
    const rawLines: any[] = order?.line_items ?? [];
    const barcodeByVariant = await fetchBarcodes(shop, rawLines.map((l) => l.variant_id).filter(Boolean));

    const line_items: ShopifyLine[] = rawLines.map((l) => ({
      sku: l.sku ?? null,
      barcode: (l.variant_id != null ? barcodeByVariant[String(l.variant_id)] : null) ?? null,
      title: l.title ?? l.name ?? null,
      quantity: Number(l.quantity ?? 0),
      price: l.price ?? null,
    }));

    const result = await pushOrderToOdoo(shop, {
      id: order.id,
      name: order.name,
      note: order.note,
      email: order.email,
      phone: order.phone,
      customer: order.customer,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      line_items,
    });

    if (!result.ok && !result.skipped) {
      console.error(`[${topic}] ${shop} order ${order?.name}: Odoo push failed — ${result.error}`);
    } else {
      console.log(
        `[${topic}] ${shop} order ${order?.name}: ${
          result.skipped ? `skipped (${result.reason})` : `→ Odoo ${result.odooOrderName}`
        }`,
      );
    }
  } catch (e) {
    // Always 200 the webhook — Shopify retries on non-2xx and we don't want a storm.
    console.error(`[${topic}] ${shop}: order sync errored`, e);
  }

  return new Response();
};

// variant id → barcode, via the Admin GraphQL API (offline session).
async function fetchBarcodes(shop: string, variantIds: (number | string)[]): Promise<Record<string, string>> {
  const ids = [...new Set(variantIds.map(String))];
  if (!ids.length) return {};
  try {
    const { admin } = await unauthenticated.admin(shop);
    const gids = ids.map((id) => `gid://shopify/ProductVariant/${id}`);
    const resp = await admin.graphql(
      `#graphql
        query Barcodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant { id barcode }
          }
        }`,
      { variables: { ids: gids } },
    );
    const body: any = await resp.json();
    const map: Record<string, string> = {};
    for (const n of body?.data?.nodes ?? []) {
      if (n?.id && n?.barcode) {
        const numeric = String(n.id).split("/").pop() as string;
        map[numeric] = n.barcode;
      }
    }
    return map;
  } catch (e) {
    console.error(`[orders/create] ${shop}: barcode lookup failed`, e);
    return {};
  }
}

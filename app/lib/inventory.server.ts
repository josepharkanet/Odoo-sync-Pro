import type { DeliveryConfig } from "./engine";

// Minimal shape of the admin GraphQL client we use (from authenticate.*).
type AdminClient = { graphql: (query: string, options?: any) => Promise<Response> };

/**
 * Read the variant's available quantity at each configured warehouse's Shopify
 * location, and return it keyed by OUR warehouse id (what the engine expects).
 */
export async function fetchStockByWarehouse(
  admin: AdminClient,
  variantGid: string,
  config: DeliveryConfig,
): Promise<Record<string, number>> {
  const resp = await admin.graphql(
    `#graphql
      query VariantStock($id: ID!) {
        productVariant(id: $id) {
          inventoryItem {
            inventoryLevels(first: 50) {
              nodes {
                location { id }
                quantities(names: ["available"]) { name quantity }
              }
            }
          }
        }
      }`,
    { variables: { id: variantGid } },
  );

  const body: any = await resp.json();
  const nodes = body?.data?.productVariant?.inventoryItem?.inventoryLevels?.nodes ?? [];

  const byLocation: Record<string, number> = {};
  for (const n of nodes) {
    const avail = (n.quantities ?? []).find((q: any) => q.name === "available");
    byLocation[n.location.id] = avail?.quantity ?? 0;
  }

  const stock: Record<string, number> = {};
  for (const wh of config.warehouses ?? []) {
    if (wh.shopifyLocationId) stock[wh.id] = byLocation[wh.shopifyLocationId] ?? 0;
  }
  return stock;
}

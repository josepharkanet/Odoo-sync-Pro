// Orchestration: map Shopify shapes onto Odoo and record what we did.
//
//  - pushOrderToOdoo:  a new Shopify order  →  a sale.order in Odoo
//                      (so the merchant can invoice / bill from Odoo).
//  - odooStockCheck:   a barcode/SKU        →  on-hand qty per warehouse
//                      (admin tool to prove the connection reads real stock).
//
// Everything is idempotent by Shopify order id + Odoo `client_order_ref`, so a
// webhook that fires twice never creates a duplicate sale order.

import prisma from "../db.server";
import { getOdooCreds, getIntegration } from "./integration.server";
import { getConfig } from "./config.server";
import {
  findProductIds,
  findProduct,
  findOrCreatePartner,
  createSaleOrder,
  findSaleOrderByRef,
  getStockByWarehouse,
  type MatchField,
} from "./odoo.server";

// The slice of a Shopify order payload we care about (orders/create webhook).
export interface ShopifyOrderLite {
  id: number | string;
  name?: string;
  note?: string | null;
  email?: string | null;
  phone?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  billing_address?: ShopifyAddr | null;
  shipping_address?: ShopifyAddr | null;
  line_items?: ShopifyLine[];
}

interface ShopifyAddr {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  phone?: string | null;
  country_code?: string | null;
}

export interface ShopifyLine {
  sku?: string | null;
  barcode?: string | null; // enriched by the webhook (not in the raw payload)
  title?: string | null;
  quantity: number;
  price?: string | number | null;
}

export interface PushResult {
  ok: boolean;
  odooOrderId?: number;
  odooOrderName?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export async function pushOrderToOdoo(shop: string, order: ShopifyOrderLite): Promise<PushResult> {
  const shopifyOrderId = String(order.id);
  const ref = order.name || `shopify-${shopifyOrderId}`;

  const creds = await getOdooCreds(shop);
  if (!creds) return { ok: false, skipped: true, reason: "Odoo not configured" };

  const integ = await getIntegration(shop);
  if (!integ.pushOrders) return { ok: false, skipped: true, reason: "Order push is turned off" };

  // Already synced? Don't touch it again.
  const prior = await prisma.orderSync.findUnique({
    where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
  });
  if (prior?.status === "synced") {
    return {
      ok: true,
      skipped: true,
      reason: "Already synced",
      odooOrderId: prior.odooOrderId ?? undefined,
      odooOrderName: prior.odooOrderName ?? undefined,
    };
  }

  const matchBy: MatchField = integ.matchBy === "sku" ? "default_code" : "barcode";
  const keyOf = (li: ShopifyLine) =>
    (integ.matchBy === "sku" ? li.sku : li.barcode || li.sku) || "";

  try {
    // Guard against a duplicate already living in Odoo (e.g. re-push after a wipe).
    const dup = await findSaleOrderByRef(creds, ref);
    if (dup) {
      await recordSync(shop, shopifyOrderId, order.name, "synced", { odooOrderId: dup.id, odooOrderName: dup.name });
      return { ok: true, skipped: true, reason: "Order already in Odoo", odooOrderId: dup.id, odooOrderName: dup.name };
    }

    const items = order.line_items ?? [];
    const idMap = await findProductIds(creds, matchBy, items.map(keyOf));

    const lines: { productId: number; qty: number; priceUnit?: number; name?: string }[] = [];
    const unmatched: string[] = [];
    for (const li of items) {
      const key = keyOf(li);
      const pid = key ? idMap[key] : undefined;
      if (!pid) {
        unmatched.push(li.sku || li.barcode || li.title || "?");
        continue;
      }
      lines.push({
        productId: pid,
        qty: li.quantity,
        priceUnit: li.price != null ? Number(li.price) : undefined,
        name: li.title || undefined,
      });
    }

    if (!lines.length) {
      throw new Error(
        `No line items matched an Odoo product by ${integ.matchBy}` +
          (unmatched.length ? ` (unmatched: ${unmatched.join(", ")})` : ""),
      );
    }

    const cust = order.customer ?? {};
    const addr = order.shipping_address || order.billing_address || {};
    const partnerId = await findOrCreatePartner(creds, {
      name: [cust.first_name, cust.last_name].filter(Boolean).join(" ") || order.email || ref,
      email: cust.email || order.email || undefined,
      phone: cust.phone || order.phone || addr.phone || undefined,
      city: addr.city || undefined,
      street: [addr.address1, addr.address2].filter(Boolean).join(", ") || undefined,
      zip: addr.zip || undefined,
      countryCode: addr.country_code || undefined,
    });

    const noteParts = [`Shopify order ${ref}`];
    if (unmatched.length) noteParts.push(`Not matched in Odoo: ${unmatched.join(", ")}`);
    if (order.note) noteParts.push(String(order.note));

    const so = await createSaleOrder(creds, {
      partnerId,
      lines,
      clientOrderRef: ref,
      note: noteParts.join("\n"),
    });

    await recordSync(shop, shopifyOrderId, order.name, "synced", {
      odooOrderId: so.id,
      odooOrderName: so.name,
      error: unmatched.length ? `Partial: unmatched ${unmatched.join(", ")}` : null,
    });
    return { ok: true, odooOrderId: so.id, odooOrderName: so.name };
  } catch (e) {
    const msg = (e as Error).message?.slice(0, 500) || "Unknown error";
    await recordSync(shop, shopifyOrderId, order.name, "error", { error: msg });
    return { ok: false, error: msg };
  }
}

async function recordSync(
  shop: string,
  shopifyOrderId: string,
  shopifyOrderName: string | undefined | null,
  status: "synced" | "error",
  extra: { odooOrderId?: number; odooOrderName?: string; error?: string | null },
): Promise<void> {
  const data = {
    shopifyOrderName: shopifyOrderName ?? null,
    status,
    odooOrderId: extra.odooOrderId ?? null,
    odooOrderName: extra.odooOrderName ?? null,
    error: extra.error ?? null,
  };
  await prisma.orderSync
    .upsert({
      where: { shop_shopifyOrderId: { shop, shopifyOrderId } },
      create: { shop, shopifyOrderId, ...data },
      update: data,
    })
    .catch(() => {
      /* never let sync bookkeeping break the webhook */
    });
}

export async function recentSyncs(shop: string, limit = 10) {
  return prisma.orderSync.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

// --- admin stock-check tool -------------------------------------------------

export interface StockCheckResult {
  ok: boolean;
  error?: string;
  product?: { id: number; name: string; barcode?: string; default_code?: string };
  byWarehouse?: { id: string; name: string; qty: number; mapped: boolean }[];
}

export async function odooStockCheck(shop: string, value: string): Promise<StockCheckResult> {
  const creds = await getOdooCreds(shop);
  if (!creds) return { ok: false, error: "Odoo not configured — save your connection first." };

  const integ = await getIntegration(shop);
  const field: MatchField = integ.matchBy === "sku" ? "default_code" : "barcode";

  try {
    const product = await findProduct(creds, field, value.trim());
    if (!product) return { ok: false, error: `No Odoo product found with ${integ.matchBy} "${value.trim()}".` };

    const config = await getConfig(shop);
    const warehouses = (config.warehouses ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      odooWarehouseId: w.odooWarehouseId ?? null,
    }));

    const stock = await getStockByWarehouse(creds, product.id, warehouses);
    const byWarehouse = warehouses.map((w) => ({
      id: w.id,
      name: w.name,
      qty: stock[w.id] ?? 0,
      mapped: w.odooWarehouseId != null,
    }));

    return {
      ok: true,
      product: { id: product.id, name: product.name, barcode: product.barcode, default_code: product.default_code },
      byWarehouse,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

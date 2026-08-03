// Odoo JSON-RPC client.
//
// Talks to Odoo's `/jsonrpc` endpoint (works on Odoo Online / Enterprise and
// self-hosted). `common.authenticate` proves the credentials and returns a uid;
// `object.execute_kw` runs any model method (search_read / create / write / read).
// The uid is cached briefly so we don't re-authenticate on every call.

export interface OdooCreds {
  url: string;
  db: string;
  login: string;
  apiKey: string;
}

export class OdooError extends Error {
  data?: unknown;
  constructor(message: string, data?: unknown) {
    super(message);
    this.name = "OdooError";
    this.data = data;
  }
}

const endpointOf = (url: string) => url.replace(/\/+$/, "") + "/jsonrpc";

async function rpc(url: string, service: string, method: string, args: unknown[]): Promise<any> {
  let r: Response;
  try {
    r = await fetch(endpointOf(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
    });
  } catch (e) {
    throw new OdooError("Could not reach Odoo: " + (e as Error).message);
  }
  let j: any;
  try {
    j = await r.json();
  } catch {
    throw new OdooError(`Odoo returned a non-JSON response (HTTP ${r.status}). Check the URL.`);
  }
  if (j?.error) {
    const msg = j.error?.data?.message || j.error?.message || "Odoo returned an error.";
    throw new OdooError(msg, j.error);
  }
  return j?.result;
}

// --- auth + uid cache -------------------------------------------------------

const uidCache = new Map<string, { uid: number; at: number }>();
const UID_TTL_MS = 10 * 60 * 1000;
const uidKey = (c: OdooCreds) => `${c.url}|${c.db}|${c.login}`;

export async function authenticateOdoo(c: OdooCreds): Promise<number> {
  const key = uidKey(c);
  const hit = uidCache.get(key);
  if (hit && Date.now() - hit.at < UID_TTL_MS) return hit.uid;
  const uid = await rpc(c.url, "common", "authenticate", [c.db, c.login, c.apiKey, {}]);
  if (typeof uid !== "number" || uid <= 0) {
    throw new OdooError("Authentication failed — check database, login and API key.");
  }
  uidCache.set(key, { uid, at: Date.now() });
  return uid;
}

// Verify credentials. Returns the user id on success. Kept for the settings UI.
export async function testOdoo(c: OdooCreds): Promise<{ ok: boolean; uid?: number; error?: string }> {
  try {
    const uid = await authenticateOdoo(c);
    return { ok: true, uid };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// --- generic model access ---------------------------------------------------

export async function execute(
  c: OdooCreds,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<any> {
  const uid = await authenticateOdoo(c);
  return rpc(c.url, "object", "execute_kw", [c.db, uid, c.apiKey, model, method, args, kwargs]);
}

export async function searchRead(
  c: OdooCreds,
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  opts: { limit?: number; order?: string; context?: Record<string, unknown> } = {},
): Promise<any[]> {
  const kwargs: Record<string, unknown> = { fields };
  if (opts.limit != null) kwargs.limit = opts.limit;
  if (opts.order) kwargs.order = opts.order;
  if (opts.context) kwargs.context = opts.context;
  return execute(c, model, "search_read", [domain], kwargs);
}

// --- products ---------------------------------------------------------------

export type MatchField = "barcode" | "default_code";

// Resolve product.product records by barcode or internal reference (default_code).
// Returns a map of the match value → Odoo product id.
export async function findProductIds(
  c: OdooCreds,
  field: MatchField,
  values: string[],
): Promise<Record<string, number>> {
  const uniq = [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
  if (!uniq.length) return {};
  const rows = await searchRead(c, "product.product", [[field, "in", uniq]], [field], { limit: 1000 });
  const map: Record<string, number> = {};
  for (const r of rows) {
    const v = r[field];
    if (v) map[String(v)] = r.id;
  }
  return map;
}

export interface OdooProductInfo {
  id: number;
  name: string;
  barcode?: string;
  default_code?: string;
}

export async function findProduct(
  c: OdooCreds,
  field: MatchField,
  value: string,
): Promise<OdooProductInfo | null> {
  const rows = await searchRead(
    c,
    "product.product",
    [[field, "=", String(value).trim()]],
    ["name", "barcode", "default_code"],
    { limit: 1 },
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    name: rows[0].display_name || rows[0].name,
    barcode: rows[0].barcode || undefined,
    default_code: rows[0].default_code || undefined,
  };
}

// On-hand quantity per configured warehouse, using Odoo's own `qty_available`
// computed field with the warehouse in context (respects that warehouse's
// stock locations). Keyed by OUR warehouse id (what the delivery engine wants).
export async function getStockByWarehouse(
  c: OdooCreds,
  productId: number,
  warehouses: { id: string; odooWarehouseId?: number | null }[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const wh of warehouses) {
    if (wh.odooWarehouseId == null) continue;
    const res = await execute(
      c,
      "product.product",
      "read",
      [[productId], ["qty_available"]],
      { context: { warehouse: wh.odooWarehouseId } },
    );
    out[wh.id] = Number(res?.[0]?.qty_available ?? 0);
  }
  return out;
}

// List the Odoo warehouses (id + name + code) so the merchant can map them.
export async function listWarehouses(
  c: OdooCreds,
): Promise<{ id: number; name: string; code?: string }[]> {
  const rows = await searchRead(c, "stock.warehouse", [], ["name", "code"], { limit: 100 });
  return rows.map((r: any) => ({ id: r.id, name: r.name, code: r.code || undefined }));
}

// --- partners + sale orders -------------------------------------------------

export interface PartnerInput {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  street?: string;
  zip?: string;
  countryCode?: string;
}

export async function findOrCreatePartner(c: OdooCreds, p: PartnerInput): Promise<number> {
  if (p.email) {
    const found = await searchRead(c, "res.partner", [["email", "=", p.email]], ["id"], { limit: 1 });
    if (found[0]) return found[0].id;
  }
  const vals: Record<string, unknown> = { name: p.name || p.email || "Shopify customer" };
  if (p.email) vals.email = p.email;
  if (p.phone) vals.phone = p.phone;
  if (p.city) vals.city = p.city;
  if (p.street) vals.street = p.street;
  if (p.zip) vals.zip = p.zip;
  if (p.countryCode) {
    const country = await searchRead(c, "res.country", [["code", "=", p.countryCode]], ["id"], { limit: 1 });
    if (country[0]) vals.country_id = country[0].id;
  }
  return execute(c, "res.partner", "create", [vals]);
}

export interface OdooLine {
  productId: number;
  qty: number;
  priceUnit?: number;
  name?: string;
}

export interface SaleOrderInput {
  partnerId: number;
  lines: OdooLine[];
  clientOrderRef?: string;
  note?: string;
}

export async function findSaleOrderByRef(
  c: OdooCreds,
  ref: string,
): Promise<{ id: number; name: string } | null> {
  const rows = await searchRead(c, "sale.order", [["client_order_ref", "=", ref]], ["name"], { limit: 1 });
  return rows[0] ? { id: rows[0].id, name: rows[0].name } : null;
}

export async function createSaleOrder(
  c: OdooCreds,
  o: SaleOrderInput,
): Promise<{ id: number; name: string }> {
  const order_line = o.lines.map((l) => [
    0,
    0,
    {
      product_id: l.productId,
      product_uom_qty: l.qty,
      ...(l.priceUnit != null ? { price_unit: l.priceUnit } : {}),
      ...(l.name ? { name: l.name } : {}),
    },
  ]);
  const vals: Record<string, unknown> = { partner_id: o.partnerId, order_line };
  if (o.clientOrderRef) vals.client_order_ref = o.clientOrderRef;
  if (o.note) vals.note = o.note;
  const id: number = await execute(c, "sale.order", "create", [vals]);
  const read = await execute(c, "sale.order", "read", [[id], ["name"]]);
  return { id, name: read?.[0]?.name ?? String(id) };
}

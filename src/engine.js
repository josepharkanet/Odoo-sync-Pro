/*
 * StockPromise — delivery-promise engine (core IP).
 * --------------------------------------------------
 * Pure, dependency-free, deterministic. No network and no Date.now() inside:
 * the caller passes `now`, so every result is testable and timezone-controlled.
 *
 * Given:  merchant config (warehouses, zones, routing + delivery rules),
 *         live free-stock per warehouse for ONE variant,
 *         the customer's location, and the current time —
 * Returns the promise the shopper should see:
 *         same-day  /  dated ETA  /  sold-out, and which warehouse fulfils it.
 *
 * This is the thing no Odoo connector does — it lives on the storefront side.
 */

// --- date helpers ----------------------------------------------------------

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWorkingDay(date, cfg) {
  const weekend = cfg.weekend || []; // JS getDay(): 0=Sun … 5=Fri, 6=Sat
  if (weekend.includes(date.getDay())) return false;
  if ((cfg.holidays || []).includes(ymd(date))) return false;
  return true;
}

function nextWorkingDay(date, cfg) {
  const d = new Date(date.getTime());
  do { d.setDate(d.getDate() + 1); } while (!isWorkingDay(d, cfg));
  return d;
}

// Add N *working* days of transit to a dispatch day.
function addBusinessDays(from, n, cfg) {
  let d = new Date(from.getTime());
  for (let i = 0; i < n; i++) d = nextWorkingDay(d, cfg);
  return d;
}

function pastCutoff(now, cutoff) {
  if (!cutoff) return false;
  const [h, m] = String(cutoff).split(":").map(Number);
  const cut = new Date(now.getTime());
  cut.setHours(h || 0, m || 0, 0, 0);
  return now.getTime() > cut.getTime();
}

const norm = (s) => String(s ?? "").trim().toLowerCase();

// --- zone resolution -------------------------------------------------------

export function resolveZone(cfg, location) {
  const emirate = norm(location?.emirate ?? location?.province);
  const city = norm(location?.city);
  for (const zone of cfg.zones || []) {
    const m = zone.match || {};
    const emirates = (m.emirate || m.province || []).map(norm);
    const cities = (m.city || []).map(norm);
    if (emirate && (emirates.includes(emirate) || cities.includes(emirate))) return zone;
    if (city && (emirates.includes(city) || cities.includes(city))) return zone;
  }
  return (cfg.zones || []).find((z) => z.default) || null;
}

// --- the promise -----------------------------------------------------------

function normalizePromise(p) {
  if (p === "same-day" || p?.type === "same-day") return { type: "same-day" };
  if (p && p.type === "days") return { type: "days", days: Number(p.days) || 1 };
  if (typeof p === "string") {
    const n = parseInt(p, 10);
    if (!Number.isNaN(n)) return { type: "days", days: n };
  }
  return { type: "days", days: 2 };
}

function labelFor(status, deliverBy) {
  if (status === "same_day") return "Same-day delivery";
  if (status === "next_day") return "Next-day delivery";
  return `Delivery by ${deliverBy}`;
}

/**
 * @returns {{available, status, zone?, warehouseId?, warehouseName?, deliverBy?, message}}
 *   status ∈ same_day | next_day | dated | sold_out | unknown_zone
 */
export function computePromise({ config, stockByWarehouse = {}, location, now }) {
  const cfg = config;
  const clock = now instanceof Date ? now : new Date(now);

  const zone = resolveZone(cfg, location);
  if (!zone) {
    return { available: null, status: "unknown_zone",
             message: "Select your area to see delivery time." };
  }

  // Nearest-first: pick the first routed warehouse that actually has free stock.
  let chosen = null;
  for (const route of zone.routes || []) {
    if (Number(stockByWarehouse[route.warehouse] || 0) > 0) { chosen = route; break; }
  }
  if (!chosen) {
    return { available: false, status: "sold_out", zone: zone.id, message: "Sold out" };
  }

  const wh = (cfg.warehouses || []).find((w) => w.id === chosen.warehouse)
             || { id: chosen.warehouse, name: chosen.warehouse };
  const handling = Number(cfg.handlingDays || 0);
  const promise = normalizePromise(chosen.promise);

  const workingNow = isWorkingDay(clock, cfg);
  const afterCut = pastCutoff(clock, cfg.cutoffTime);

  // Dispatch day = today if we can still ship today, else the next working day.
  let dispatch = new Date(clock.getTime());
  if (!workingNow || afterCut) dispatch = nextWorkingDay(dispatch, cfg);
  if (handling > 0) dispatch = addBusinessDays(dispatch, handling, cfg);

  let deliverBy, status;
  if (promise.type === "same-day") {
    if (workingNow && !afterCut && handling === 0) {
      deliverBy = new Date(clock.getTime());
      status = "same_day";
    } else {
      deliverBy = dispatch;            // missed the same-day window
      status = "next_day";
    }
  } else {
    deliverBy = addBusinessDays(dispatch, promise.days, cfg);
    status = promise.days <= 1 ? "next_day" : "dated";
  }

  return {
    available: true,
    status,
    zone: zone.id,
    warehouseId: wh.id,
    warehouseName: wh.name,
    deliverBy: ymd(deliverBy),
    message: labelFor(status, ymd(deliverBy)),
  };
}

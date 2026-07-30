# StockPromise — Functions Specification

**What it is:** a connector-agnostic, customer-facing **delivery-promise** app for Shopify.
It reads per-warehouse stock + the shopper's zone and shows a live **same-day / dated ETA / sold-out** promise, then tags the order for correct fulfilment.

**What it is NOT:** the Odoo↔Shopify *sync*. That is the connector's job (Emipro, the official module, or the merchant's own). StockPromise *reads* the per-location stock the connector maintains — which is what makes it sellable to any store.

**Locked decisions**
- MVP = delivery-intelligence only. Direct-Odoo sync = optional P2 module.
- Stack: Node + Shopify Remix app template + Prisma/Postgres + Theme App Extension. Deploy on Coolify.
- Multi-tenant SaaS, billed via Shopify Billing API. Elixir = tenant #1.

Tags: **[MVP]** first release · **[P2]/[P3]** later.

## 1. Onboarding & Setup
- [MVP] Shopify OAuth install (public app) · embedded admin (App Bridge) · setup wizard
- [MVP] Data source: Shopify Locations (auto) and/or Odoo (URL, DB, API key — encrypted)
- [MVP] Free trial + paid plans (Shopify Billing API)

## 2. Warehouse / Location config
- [MVP] Auto-detect Shopify Locations · give each a geo point (emirate/city) · enable/disable
- [P2] Direct Odoo warehouse read (free_qty) · stock mode: free/on-hand/forecasted

## 3. Zones & Rules engine  *(built — src/engine.js)*
- [MVP] Zones (emirate/city/shipping-zone) · zone → primary + fallback warehouses (proximity)
- [MVP] Per-warehouse promise per zone (same-day / next-day / N-day)
- [MVP] Cutoff time · working days · weekend · holidays · blackout dates
- [MVP] Handling/lead time per product/type/vendor
- [P2] Express vs standard tiers

## 4. Stock-aware ETA computation  *(built — src/engine.js)*
- [MVP] variant + zone → nearest warehouse WITH stock → delivery date
- [MVP] nearest empty → fallback ETA · zero everywhere → sold-out
- [MVP] cart-level ETA (slowest item) + split-shipment note
- [MVP] fast inventory cache (storefront must be instant)

## 5. Storefront display
- [MVP] PDP widget ("Get it by <date>" / same-day badge) · zone selector + auto-detect
- [MVP] Cart messaging · Arabic + English + RTL · Theme App Extension (any theme) · brand styling
- [P2] Countdown urgency · collection badges + "Same-day" filter · low-stock urgency
- [P3] Checkout UI extension

## 6. Order routing & tagging
- [MVP] Tag order with chosen warehouse + delivery type · write promised date to metafield
- [P2] Push warehouse hint to Odoo/connector
- [P3] Courier integrations (Aramex / Quiqup / Fetchr)

## 7. Analytics
- [MVP] Same-day eligibility rate · sold-out/near-miss by zone & product
- [P2] Conversion lift · ETA accuracy · missed-cutoff alerts

## 8. Platform / Multi-tenant
- [MVP] Tenant isolation + encrypted creds · GDPR compliance webhooks · clean uninstall
- [MVP] Shopify API rate-limit handling + retry/queue · vendor back-office
- [P2] Sync-health monitor + mismatch flags

## 9. Optional Direct-Odoo module (upsell)
- [P2] Lightweight Odoo→Shopify stock pull (for merchants with no connector)
- [P3] Basic order push to Odoo

---

## MVP cut
Modules 1–6 + 8 at [MVP] = installable, billable app that lets a merchant define zones/warehouses/cutoffs and shows shoppers a live same-day/2-day/sold-out promise in AR+EN, tags orders, on any store.

## Owner inputs required (business facts)
- Warehouses (name + emirate)
- Zone → nearest, then fallback (proximity map)
- Same-day cutoff time
- Delivery/weekend days · public holidays
- Products needing extra prep days

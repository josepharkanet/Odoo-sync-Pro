# StockPromise

Stock-aware **delivery-promise** app for Shopify. Shows every shopper a real
"same-day / delivered-by / sold-out" promise based on **which warehouse has the
item** and **where the customer is** — the thing Odoo connectors don't do because
they live in the back office, not on the storefront.

Connector-agnostic: it reads the per-location inventory that any connector
(Emipro, the official Odoo module, or Shopify-native) already maintains.

## Status
- ✅ **Delivery engine** (`src/engine.js`) — pure, tested logic. Run it:
  ```bash
  npm run test:engine
  ```
- ⬜ Shopify Remix app shell (OAuth, admin, billing) — needs a Partner account
- ⬜ Theme App Extension (storefront widget)
- ⬜ Admin config UI

See [FUNCTIONS.md](FUNCTIONS.md) for the full spec and roadmap.

## Layout
```
src/engine.js              delivery-promise engine (core IP)
config/example-elixir.json example merchant config (placeholder data)
test/engine.run.mjs        proof scenarios
```

## The engine, in one line
`computePromise({ config, stockByWarehouse, location, now })` →
`{ status: same_day|next_day|dated|sold_out, warehouseName, deliverBy, message }`

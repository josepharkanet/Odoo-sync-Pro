# Odoo connector — going live

The connector reads live stock from Odoo and creates a sale order in Odoo for
every new Shopify order. To switch it on you need four values from Odoo plus a
one-time warehouse mapping.

## 1. Get these from Odoo (the only external step)

| Value | Where in Odoo |
|-------|---------------|
| **URL** | Your Odoo web address, e.g. `https://elixir.odoo.com` |
| **Database name** | Settings → (developer mode) shown in the About dialog, or the `db` in the login page |
| **Login** | The email of a dedicated integration user (give it Sales + Inventory access) |
| **API key** | As that user: top-right avatar → My Profile → Account Security → **New API Key** |

Create a **separate Odoo user** for the integration (not a person's login) so the
API key can be rotated without locking anyone out.

## 2. Connect

Admin → the app → **Odoo integration**:
1. Paste URL, database, login, API key → **Test connection** (expect "Connected ✓").
2. **Match products by**: `Barcode` (Odoo barcode) or `SKU` (Odoo internal
   reference / `default_code`). Elixir uses **Barcode**.
3. Leave **Create an Odoo sale order for each new Shopify order** ticked → **Save**.

## 3. Map warehouses (for stock reads)

In **Delivery rules**, each warehouse entry takes:
- `shopifyLocationId` — from the "Your Shopify locations" panel on the integration page.
- `odooWarehouseId` — the Odoo `stock.warehouse` id (Inventory → Configuration →
  Warehouses; the id is in the URL when you open one).

## 4. Verify

- **Odoo integration → Check Odoo stock**: enter a barcode → you should see the
  on-hand quantity per mapped warehouse. This proves the live read works.
- Place a **test Shopify order** → it appears under **Recent order syncs** as
  "Synced" with its Odoo order number (e.g. `S00042`). Open it in Odoo to confirm
  the customer, lines and quantities.

## How it behaves

- **Idempotent**: the Shopify order name is stored as the Odoo `client_order_ref`,
  so a webhook firing twice never creates a duplicate.
- **Unmatched lines**: if a line's barcode/SKU isn't found in Odoo, the order is
  still created with the matched lines and the unmatched ones are listed in the
  order's note (and flagged on the sync row) so nothing is silently dropped.
- **COD friendly**: fires on `orders/create` (not `orders/paid`), so cash-on-
  delivery orders sync too. The Odoo sale order is created as a quotation for your
  team to confirm and invoice.

## Not included yet (next phase)

- Pushing Odoo stock **back into** Shopify inventory (needs `write_inventory`
  scope + a scheduler). Today the delivery widget reads Shopify inventory; the
  connector reads Odoo stock on demand via the stock-check tool. Wiring the
  automatic Odoo→Shopify inventory sync is the next step.

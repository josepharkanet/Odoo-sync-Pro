# ☀️ When you wake up — 2 steps to see StockPromise live

Everything is built and committed. To run it in a test store, do these two things.
If anything looks off, just tell me what you see and I'll handle it.

## Step 1 — Create a development store (2 min, free)
1. Go to the **Dev Dashboard** (`dev.shopify.com`) → make sure the org is **Arkanet Technologies**.
2. Left menu → **Stores** → **Add store** → **Create development store**.
3. Name it e.g. *StockPromise Dev* → Create.

## Step 2 — Launch the app
Open **Terminal** and run:

```
cd ~/Desktop/stockpromise && npm run dev
```

What will happen (all normal):
- It opens your **browser to log in** → click **Allow / Confirm**.
- It may ask to **connect to an existing app** → choose **Odoo sync Pro** (that's our app).
- It asks **which store** → pick **StockPromise Dev**.
- It may ask **"update app URLs?"** → **Yes**.
- It prints a **Preview URL** → open it → click **Install app**.

The app opens inside your dev store admin. Click **Delivery rules** in the left nav — you'll see the config editor and a live **"Test a promise"** box (type an emirate + stock and hit Preview).

## Step 3 (optional) — see the storefront widget
1. In the dev store: **Online Store → Themes → Customize**.
2. Open a **product** page → **Add block** → under *Apps* pick **Delivery promise**.
3. Set the warehouse **Shopify Location IDs** in **Delivery rules** first (so stock reads correctly).

---

## What's already done
- ✅ Delivery engine (same-day / dated / sold-out, cutoff + weekend + holidays)
- ✅ Per-shop config storage + admin **Delivery rules** screen (with live preview)
- ✅ App Proxy endpoint (`/delivery`) that runs the engine on live inventory
- ✅ Storefront **widget** (Theme App Extension): area selector + delivery badge, AR/EN label-ready
- ✅ App created, keys wired, builds clean

## Still needs you (not blocking the build)
- Your real **warehouses + zones + cutoff + weekend/holidays** (drop them in `Delivery rules` or send me the list).
- One thing to confirm once dev is running: the **App Proxy URL** should point at the dev tunnel (the CLI usually sets this; if the widget shows nothing, tell me and I'll fix the proxy URL).

# Deploying StockPromise to Coolify

The app is a standard Dockerized Node app. Repo: `josepharkanet/Odoo-sync-Pro`.

## 1. Create the resource in Coolify
- **New Project** (keep it isolated from the live apps) → **Add Resource** →
  **Private Repository** → paste the repo URL.
  - If the repo is private, add Coolify's **deploy key** to the GitHub repo
    (Coolify shows the key; GitHub → repo → Settings → Deploy keys → Add).
- **Build pack:** Dockerfile (auto-detected).
- **Port / Ports Exposes:** `3000`.

## 2. Persistent storage (for the SQLite DB)
- Add a **Persistent Storage / Volume** mounted at **`/app/data`**.
  (Without this the database resets on every redeploy.)

## 3. Environment variables
```
SHOPIFY_API_KEY=8364d84e0b554fc670721e79ccc390cc
SHOPIFY_API_SECRET=<from the app's .env — the shpss_… value>
SCOPES=read_products,read_inventory,read_locations,read_orders,write_orders
SHOPIFY_APP_URL=<the Coolify domain, filled in after step 4>
DATABASE_URL=file:/app/data/prod.sqlite
NODE_ENV=production
```

## 4. Domain
- Simplest first deploy: use Coolify's auto **`<id>.sslip.io`** domain (auto-HTTPS,
  no DNS needed). Copy it into `SHOPIFY_APP_URL` and redeploy.
- Later: a custom subdomain (needs a DNS record → the Coolify server IP).

## 5. Deploy
- Click **Deploy**. The container runs `npm run docker-start`
  (`prisma migrate deploy` creates the tables, then starts the server).

## 6. Point Shopify at the deployed app
On this Mac, update `shopify.app.toml` — set `application_url`, the three
`auth.redirect_urls`, and `app_proxy.url` to the Coolify domain — then:
```
shopify app deploy
```
(or set the same URLs in the Dev Dashboard app → Configuration).

## 7. Install on a store
- Test store first, then (for real use) **custom distribution → the Elixir store**.
- Set the warehouses' **Shopify Location IDs** in *Delivery rules*, and the real
  zones/cutoff, before adding the storefront widget to a live theme.

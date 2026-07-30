import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { useRef } from "react";

import { login } from "../../shopify.server";
import { Logo } from "../../components/Logo";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

// Accept a store name, a full .myshopify.com domain, or a pasted admin URL,
// and turn it into the myshopify domain Shopify expects.
function normalizeShop(raw: string): string {
  let s = (raw || "").trim().toLowerCase();
  if (!s) return s;
  const admin = s.match(/admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (admin) return `${admin[1]}.myshopify.com`;
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (s.endsWith(".myshopify.com")) return s;
  if (s.includes(".")) return s;
  return `${s}.myshopify.com`;
}

const FEATURES = [
  { t: "Same-day, done right", d: "Promises same-day only when the nearest warehouse can actually deliver." },
  { t: "Honest fallback ETA", d: "Ships from another warehouse? Shoppers see a real delivery date, not a guess." },
  { t: "Never oversell", d: "Out of stock across every warehouse and the product shows sold-out automatically." },
  { t: "Shopper area selector", d: "Customers pick their area and instantly see their own delivery time." },
  { t: "Arabic and English", d: "Right-to-left ready, so Gulf storefronts read perfectly." },
  { t: "Fits your stack", d: "Reads Shopify locations or connects straight to Odoo. Works on any theme." },
];

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (inputRef.current) inputRef.current.value = normalizeShop(inputRef.current.value);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.brand}>
          <Logo size={44} />
        </div>

        <h1 className={styles.heading}>Turn your warehouses into a delivery promise.</h1>
        <p className={styles.text}>
          Show every shopper a real, stock-aware delivery date: same-day when the item is in their
          nearest warehouse, and an honest ETA when it ships from further away.
        </p>

        {showForm && (
          <Form className={styles.install} method="post" action="/auth/login" onSubmit={handleSubmit}>
            <span className={styles.installLabel}>Connect your Shopify store to install</span>
            <div className={styles.installRow}>
              <input
                ref={inputRef}
                className={styles.input}
                type="text"
                name="shop"
                placeholder="your store name or your-store.myshopify.com"
              />
              <button className={styles.button} type="submit">
                Connect store
              </button>
            </div>
            <span className={styles.installHint}>
              Type your store name (like "elixir"), the full .myshopify.com address, or paste your
              admin URL. We handle the rest.
            </span>
          </Form>
        )}
      </section>

      <section className={styles.features}>
        <h2 className={styles.fheading}>What it does</h2>
        <div className={styles.fgrid}>
          {FEATURES.map((f) => (
            <div className={styles.f} key={f.t}>
              <span className={styles.fdot} aria-hidden="true"></span>
              <div>
                <b className={styles.ft}>{f.t}</b>
                <span className={styles.fd}>{f.d}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

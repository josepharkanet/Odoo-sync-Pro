import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

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

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <Logo size={40} />
        </div>

        <h1 className={styles.heading}>Turn your warehouses into a delivery promise.</h1>
        <p className={styles.text}>
          StockPromise shows every shopper a real, stock-aware delivery date — same-day when the
          item is in their nearest warehouse, an honest ETA when it ships from further away.
        </p>

        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Install on your store</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="my-shop.myshopify.com"
              />
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}

        <ul className={styles.list}>
          <li>
            <strong>Same-day, done right.</strong> Promises same-day only when the nearest
            warehouse can actually deliver.
          </li>
          <li>
            <strong>Never oversell.</strong> Out of stock everywhere? The product shows sold-out
            automatically.
          </li>
          <li>
            <strong>Fits your stack.</strong> Reads Shopify locations or connects to Odoo. Arabic
            &amp; English out of the box.
          </li>
        </ul>

        <p className={styles.footer}>
          An <strong>Arkanet</strong> product
        </p>
      </div>
    </div>
  );
}

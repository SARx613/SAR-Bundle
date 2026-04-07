import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

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
        <h1 className={styles.heading}>SAR Bundle</h1>
        <p className={styles.text}>
          The ultimate interactive bundle builder for Shopify. Boost your AOV with custom mix & match offers.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" placeholder="my-shop.myshopify.com" />
            </label>
            <button className={styles.button} type="submit">
              Install App
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Mix & Match Bundles</strong>. Let customers build their own packs with our interactive multi-step builder.
          </li>
          <li>
            <strong>Usage-Based Pricing</strong>. Pay only as you grow. 100% free until you reach 200€ in bundle revenue.
          </li>
          <li>
            <strong>OS 2.0 Compatible</strong>. Seamlessly integrate with your theme using App Blocks. No code required.
          </li>
        </ul>

        <footer style={{ marginTop: "40px", display: "flex", gap: "20px", fontSize: "0.9rem", opacity: 0.7 }}>
          <a href="/privacy" style={{ color: "inherit" }}>Privacy Policy</a>
          <a href="/faq" style={{ color: "inherit" }}>FAQ</a>
        </footer>
      </div>
    </div>
  );
}

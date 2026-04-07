import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Banner, BlockStack } from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import { BILLING_PLANS, type BillingPlanHandle } from "../utils/billing-plans";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// ─── Helper: first day of current UTC month ────────────────────────────────

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  // Enforce the usage-based billing plan!
  await billing.require({
    plans: [BILLING_PLANS.sar_bundle_plan.handle],
    isTest: true, // MUST BE true for Development Stores!
    onFailure: async () => billing.request({
      plan: BILLING_PLANS.sar_bundle_plan.handle,
      isTest: true, // MUST BE true for Development Stores!
    }),
  });

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
  });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Accueil
        </Link>
        <Link to="/app/bundles">Bundles</Link>
        <Link to="/app/translations">Textes &amp; Langues</Link>
        <Link to="/app/pricing">Abonnement</Link>
      </NavMenu>

      <BlockStack gap="0">
        <Outlet />
      </BlockStack>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Banner, BlockStack } from "@shopify/polaris";

import { authenticate, BILLING_PLANS, type BillingPlanHandle } from "../shopify.server";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// ─── Helper: first day of current UTC month ────────────────────────────────

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch billing record — if none, default to free_tier with 0 revenue
  let activePlan: BillingPlanHandle = "free_tier";
  let monthlyRevenue = 0;

  try {
    const billing = await prisma.shopBilling.findUnique({
      where: { shopDomain: shop },
    });
    if (billing) {
      activePlan = billing.activePlan as BillingPlanHandle;
      // Check if revenue needs a monthly reset
      const monthStart = startOfCurrentMonthUTC();
      if (billing.revenueResetAt < monthStart) {
        // The webhook will do the reset on the next order, but we show 0 here
        monthlyRevenue = 0;
      } else {
        monthlyRevenue = billing.monthlyBundleRevenue;
      }
    }
  } catch {
    // Table may not exist yet before first migration — fail silently
  }

  const planConfig = BILLING_PLANS[activePlan];
  const revenueLimit = planConfig.revenueLimit;
  const planWarning =
    revenueLimit !== Infinity && monthlyRevenue > revenueLimit;

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    activePlan,
    monthlyRevenue,
    revenueLimit,
    planWarning,
    planName: planConfig.name,
  });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function App() {
  const { apiKey, planWarning, activePlan, planName } =
    useLoaderData<typeof loader>();

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
        {planWarning && (
          <div style={{ padding: "16px 16px 0" }}>
            <Banner
              tone="critical"
              title="Limite de chiffre d'affaires dépassée"
              action={{
                content: "Passer au plan supérieur",
                url: "/app/pricing",
              }}
            >
              <p>
                Vous avez dépassé la limite de revenus de votre plan{" "}
                <strong>{planName}</strong>. Veuillez passer au plan supérieur
                pour continuer à profiter de toutes les fonctionnalités SAR
                Bundle sans interruption.
              </p>
            </Banner>
          </div>
        )}
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

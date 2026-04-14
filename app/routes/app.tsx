import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Banner, BlockStack } from "@shopify/polaris";
import { useEffect } from "react";

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

  // Catch React hydration errors (#418, #423) that happen after stale deploys.
  // These errors are thrown outside React's render tree and won't be caught
  // by ErrorBoundary — a full reload is the only reliable fix.
  useEffect(() => {
    function handleGlobalError(event: ErrorEvent) {
      const msg = event?.error?.message || event?.message || "";
      if (
        msg.includes("Minified React error") ||
        msg.includes("#418") ||
        msg.includes("#423") ||
        msg.includes("Hydration") ||
        msg.includes("hydrat")
      ) {
        console.warn("[SAR] React hydration error détecté, rechargement…", msg);
        window.location.reload();
      }
    }
    window.addEventListener("error", handleGlobalError);
    return () => window.removeEventListener("error", handleGlobalError);
  }, []);

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

// Custom ErrorBoundary : récupère les erreurs de rendu cryptiques
// (session expirée, redéploiement Render, React stale)
export function ErrorBoundary() {
  const error = useRouteError();

  const isStaleError =
    error == null ||
    (error instanceof Error &&
      (error.message === "undefined" ||
        error.message === "" ||
        error.message?.toLowerCase().includes("unexpected server error") ||
        error.message?.toLowerCase().includes("minified react"))) ||
    (isRouteErrorResponse(error) && error.status >= 500);

  useEffect(() => {
    if (isStaleError) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isStaleError]);

  if (isStaleError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Inter, sans-serif",
          background: "#f6f6f7",
          gap: "16px",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ fontSize: "40px" }}>🔄</div>
        <h2 style={{ margin: 0, fontSize: "20px", color: "#202223" }}>
          Rechargement en cours…
        </h2>
        <p style={{ margin: 0, color: "#6d7175", fontSize: "14px" }}>
          Une erreur temporaire s&apos;est produite. Rechargement dans 3 secondes…
        </p>
        <a
          href="/app"
          style={{
            marginTop: "8px",
            padding: "10px 20px",
            background: "#008060",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Retourner à l&apos;accueil maintenant
        </a>
      </div>
    );
  }

  // Pour toute vraie erreur non-stale, utiliser le boundary Shopify par défaut
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import layoutOverrides from "../styles/polaris-layout-overrides.css?url";
import { BlockStack } from "@shopify/polaris";
import { useEffect } from "react";

import { authenticate } from "../shopify.server";
import { BILLING_PLANS } from "../utils/billing-plans";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  // Overrides chargés APRÈS Polaris pour garantir la priorité sur toutes les pages
  { rel: "stylesheet", href: layoutOverrides },
];

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // L'authentification peut lever une redirection (échange de jeton App Bridge).
  // On la laisse remonter telle quelle — ne JAMAIS l'envelopper dans un try/catch.
  const { billing } = await authenticate.admin(request);

  // Vérifie l'abonnement usage-based.
  try {
    await billing.require({
      plans: [BILLING_PLANS.sar_bundle_plan.handle],
      isTest: true, // MUST BE true for Development Stores!
      onFailure: async () =>
        billing.request({
          plan: BILLING_PLANS.sar_bundle_plan.handle,
          isTest: true, // MUST BE true for Development Stores!
        }),
    });
  } catch (err) {
    // Une redirection (Response) = abonnement requis → on la laisse passer.
    if (err instanceof Response) throw err;
    // Sinon = panne transitoire de l'API Billing : on n'enferme pas le marchand
    // hors de l'app pour autant. L'app se charge, la facturation se revérifie au prochain appel.
    console.error("[SAR] billing.require a échoué (panne transitoire ?) — chargement de l'app malgré tout", err);
  }

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
    // L'app s'est rendue avec succès → on réinitialise le compteur de rechargements.
    try {
      sessionStorage.removeItem("sar-reload-count");
    } catch {
      /* sessionStorage indisponible */
    }
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
    if (!isStaleError) return;
    // Rechargement borné : on retente au maximum 3 fois d'affilée pour éviter
    // une boucle infinie quand l'erreur est persistante (ex. base injoignable).
    let count = 0;
    try {
      count = parseInt(sessionStorage.getItem("sar-reload-count") || "0", 10) || 0;
    } catch {
      /* sessionStorage indisponible */
    }
    if (count >= 1) return; // un seul rechargement auto (stale deploy), puis bouton manuel — pas de boucle
    try {
      sessionStorage.setItem("sar-reload-count", String(count + 1));
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      // reload() recharge l'URL COURANTE (avec les paramètres embarqués host/shop),
      // ce qui permet à App Bridge de refaire l'échange de jeton — contrairement à
      // une navigation vers "/app" qui sortirait de l'iframe et tomberait sur /auth/login.
      window.location.reload();
    }, 3000);
    return () => clearTimeout(timer);
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
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem("sar-reload-count");
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          style={{
            marginTop: "8px",
            padding: "10px 20px",
            background: "#008060",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Réessayer maintenant
        </button>
      </div>
    );
  }

  // Pour toute vraie erreur non-stale, utiliser le boundary Shopify par défaut
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

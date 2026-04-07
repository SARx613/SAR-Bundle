import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// ─── Plan definitions (shared — importable client & server) ────────────────
export { BILLING_PLANS, type BillingPlanHandle } from "./utils/billing-plans";

// ─── Scopes ──────────────────────────────────────────────────────────────────
const DEFAULT_SCOPES_FROM_TOML = [
  "read_products",
  "write_files",
  "read_files",
  "read_orders",
  "write_products",
] as const;

function appScopes(): string[] {
  const raw = process.env.SCOPES?.trim();
  if (!raw) {
    return [...DEFAULT_SCOPES_FROM_TOML];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: appScopes(),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    starter_tier: {
      lineItems: [
        {
          amount: 14.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
    pro_tier: {
      lineItems: [
        {
          amount: 39.99,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // Register the orders/paid webhook programmatically so it doesn't
      // need to be in shopify.app.toml (avoids "protected customer data" CLI block).
      const appUrl = process.env.SHOPIFY_APP_URL || "";
      const callbackUrl = `${appUrl}/webhooks/orders/paid`;
      try {
        await admin.graphql(
          `#graphql
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              userErrors { field message }
              webhookSubscription { id }
            }
          }`,
          {
            variables: {
              topic: "ORDERS_PAID",
              webhookSubscription: {
                callbackUrl,
                format: "JSON",
              },
            },
          },
        );
      } catch (err) {
        console.error("[SAR] Failed to register orders/paid webhook:", err);
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

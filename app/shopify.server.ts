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
import { BILLING_PLANS, type BillingPlanHandle } from "./utils/billing-plans";
import { syncShopSubscriptionLineItemId } from "./utils/billing.server";
export { BILLING_PLANS, type BillingPlanHandle };

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

const DEFAULT_APP_URL = "https://sar-bundle.vercel.app";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April26,
  scopes: appScopes(),
  appUrl: process.env.SHOPIFY_APP_URL || DEFAULT_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    sar_bundle_plan: {
      lineItems: [
        {
          amount: BILLING_PLANS.sar_bundle_plan.amount,
          currencyCode: BILLING_PLANS.sar_bundle_plan.currencyCode,
          interval: BillingInterval.Every30Days,
        },
        {
          terms: BILLING_PLANS.sar_bundle_plan.usageTerms,
          amount: BILLING_PLANS.sar_bundle_plan.cappedAmount,
          currencyCode: BILLING_PLANS.sar_bundle_plan.currencyCode,
          interval: BillingInterval.Usage,
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
      const shop = session.shop;

      // 1. Register the orders/paid webhook programmatically
      const appUrl = (process.env.SHOPIFY_APP_URL || DEFAULT_APP_URL).trim().replace(/\/+$/, "");
      if (appUrl.startsWith("https://")) {
        const callbackUrl = `${appUrl}/webhooks/orders/paid`;
        try {
          await admin.graphql(
            `#graphql
            mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
              webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                userErrors { field message }
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
      }

      // 2. Extract and store the usage subscription line item ID
      await syncShopSubscriptionLineItemId(admin, shop);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.April26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

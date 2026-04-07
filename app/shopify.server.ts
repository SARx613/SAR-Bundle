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
      const appUrl = process.env.SHOPIFY_APP_URL || "";
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

      // 2. Extract and store the usage subscription line item ID
      try {
        const response = await admin.graphql(
          `#graphql
          query {
            currentAppInstallation {
              activeSubscriptions {
                id
                name
                lineItems {
                  id
                  plan {
                    pricingDetails {
                      __typename
                    }
                  }
                }
              }
            }
          }`
        );
        const data = await response.json();
        const subscriptions = data.data?.currentAppInstallation?.activeSubscriptions || [];
        
        // Find the SAR Bundle SAR plan subscription
        const sarSub = subscriptions.find((s: any) => s.name === BILLING_PLANS.sar_bundle_plan.name);
        
        let usageLineItemId = null;
        if (sarSub && sarSub.lineItems) {
          const usageLineItem = sarSub.lineItems.find((li: any) => 
            li.plan?.pricingDetails?.__typename === "AppUsagePricing"
          );
          if (usageLineItem) {
            usageLineItemId = usageLineItem.id;
          }
        }

        // Upsert ShopBilling to store this ID
        if (usageLineItemId) {
          await prisma.shopBilling.upsert({
            where: { shopDomain: shop },
            create: {
              shopDomain: shop,
              subscriptionLineItemId: usageLineItemId,
            },
            update: {
              subscriptionLineItemId: usageLineItemId,
              updatedAt: new Date(),
            },
          });
          console.log(`[SAR] Stored usage line item ID for ${shop}`);
        } else {
          console.warn(`[SAR] No usage line item ID found for ${shop} — billing might not be active yet.`);
        }
      } catch (err) {
        console.error("[SAR] Failed to sync subscriptionLineItemId:", err);
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

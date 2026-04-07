/**
 * Shared billing plan definitions.
 * Ce fichier est importable côté client ET serveur.
 * NE PAS importer shopify.server ici.
 */

export const BILLING_PLANS = {
  free_tier: {
    handle: "free_tier",
    name: "Free",
    amount: 0,
    currencyCode: "USD",
    revenueLimit: 200, // USD/month
  },
  starter_tier: {
    handle: "starter_tier",
    name: "Starter",
    amount: 14.99,
    currencyCode: "USD",
    revenueLimit: 1500, // USD/month
  },
  pro_tier: {
    handle: "pro_tier",
    name: "Pro",
    amount: 39.99,
    currencyCode: "USD",
    revenueLimit: Infinity, // Unlimited
  },
} as const;

export type BillingPlanHandle = keyof typeof BILLING_PLANS;

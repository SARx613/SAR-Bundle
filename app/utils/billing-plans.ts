/**
 * Shared billing plan definitions.
 * Ce fichier est importable côté client ET serveur.
 * NE PAS importer shopify.server ici.
 */

export const BILLING_PLANS = {
  sar_bundle_plan: {
    handle: "sar_bundle_plan",
    name: "SAR Bundle",
    amount: 0, // Recurring is 0, we charge via usage API
    currencyCode: "EUR",
    cappedAmount: 39.99, // Plafond mensuel
    usageTerms: "Free up to 200€ of generated revenue. +14.99€ if >200€. +25.00€ if >1200€ (Max 39.99€/month)",
  },
} as const;

export type BillingPlanHandle = keyof typeof BILLING_PLANS;

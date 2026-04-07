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
    usageTerms: "Gratuit jusqu'à 200€ de CA généré. +14.99€ si >200€. +25.00€ si >1200€ (Max 39.99€/mois)",
  },
} as const;

export type BillingPlanHandle = keyof typeof BILLING_PLANS;

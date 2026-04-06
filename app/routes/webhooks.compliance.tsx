import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory Shopify GDPR Webhooks:
 * - CUSTOMERS_DATA_REQUEST
 * - CUSTOMERS_REDACT
 * - SHOP_REDACT
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} for ${shop}`, JSON.stringify(payload));

  if (topic === "SHOP_REDACT") {
    // Delete all shop data: sessions, bundles (cascades to steps, rules, etc.),
    // and translation overrides.
    try {
      await db.$transaction([
        db.session.deleteMany({ where: { shop } }),
        // Delete translation overrides
        ...((() => {
          try {
            return [(db as any).translationOverride.deleteMany({ where: { shopDomain: shop } })];
          } catch {
            return [];
          }
        })()),
        // Bundles cascade-delete steps, rules, tiers, products, line item properties
        db.bundle.deleteMany({ where: { shopDomain: shop } }),
      ]);
      console.log(`[GDPR] Successfully redacted all data for shop ${shop}`);
    } catch (e) {
      console.error(`[GDPR] Error redacting data for shop ${shop}:`, e);
    }
  }

  // SAR Bundle does not store customer-specific data.
  // No customer data to export or redact, so CUSTOMERS_DATA_REQUEST and CUSTOMERS_REDACT
  // simply return 200.
  return new Response(null, { status: 200 });
};

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ─── Types (minimal — Shopify sends a full order object) ─────────────────────

interface OrderProperty {
  name: string;
  value: string;
}

interface OrderLineItem {
  price: string;
  quantity: number;
  properties: OrderProperty[];
}

interface ShopifyOrder {
  id: number;
  financial_status: string;
  line_items: OrderLineItem[];
}

// ─── Helper: returns the first day of the current UTC month ──────────────────

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[SAR] Webhook received: ${topic} for ${shop}`);

  const order = payload as unknown as ShopifyOrder;

  // Only process paid orders
  if (order.financial_status !== "paid") {
    return new Response(null, { status: 200 });
  }

  // ── Find line items that contain a SAR bundle
  let bundleRevenue = 0;

  for (const item of order.line_items ?? []) {
    const hasBundleProp = (item.properties ?? []).some(
      (p) => p.name === "_sar_bundle_id" && p.value,
    );
    if (hasBundleProp) {
      const itemPrice = parseFloat(item.price) * (item.quantity ?? 1);
      if (!isNaN(itemPrice)) {
        bundleRevenue += itemPrice;
      }
    }
  }

  if (bundleRevenue <= 0) {
    return new Response(null, { status: 200 });
  }

  console.log(`[SAR] Order contains ${bundleRevenue.toFixed(2)}€ of bundle revenue for ${shop}`);

  // ── Upsert ShopBilling with monthly reset logic
  const monthStart = startOfCurrentMonthUTC();

  let existing = await prisma.shopBilling.findUnique({
    where: { shopDomain: shop },
  });

  if (!existing) {
    existing = await prisma.shopBilling.create({
      data: {
        shopDomain: shop,
        monthlyBundleRevenue: 0,
        revenueResetAt: monthStart,
      },
    });
  }

  const needsReset = existing.revenueResetAt < monthStart;
  
  const newTotal = needsReset 
    ? bundleRevenue 
    : existing.monthlyBundleRevenue + bundleRevenue;

  // ── Logic Usage Charges
  let charged200_update = needsReset ? false : existing.charged200;
  let charged1200_update = needsReset ? false : existing.charged1200;
  
  const { createUsageRecord } = await import("../utils/billing.server");

  // Threshold 1: 200€
  if (newTotal > 200 && !charged200_update) {
    if (existing.subscriptionLineItemId) {
      const success = await createUsageRecord(
        admin, 
        existing.subscriptionLineItemId, 
        14.99, 
        "Dépassement du seuil de base (200€) — SAR Bundle"
      );
      if (success) charged200_update = true;
    } else {
      console.warn(`[SAR] Reached 200 threshold for ${shop} but no subscriptionLineItemId is stored.`);
    }
  }

  // Threshold 2: 1200€
  if (newTotal > 1200 && !charged1200_update) {
    if (existing.subscriptionLineItemId) {
      const success = await createUsageRecord(
        admin, 
        existing.subscriptionLineItemId, 
        25.00, 
        "Dépassement du seuil pro (1200€) — SAR Bundle"
      );
      if (success) charged1200_update = true;
    } else {
      console.warn(`[SAR] Reached 1200 threshold for ${shop} but no subscriptionLineItemId is stored.`);
    }
  }

  // Update record in database
  await prisma.shopBilling.update({
    where: { shopDomain: shop },
    data: {
      monthlyBundleRevenue: newTotal,
      revenueResetAt: needsReset ? monthStart : existing.revenueResetAt,
      charged200: charged200_update,
      charged1200: charged1200_update,
      updatedAt: new Date(),
    },
  });

  if (needsReset) {
    console.log(`[SAR] Monthly reset applied for ${shop}. New total: ${bundleRevenue.toFixed(2)}€`);
  }

  return new Response(null, { status: 200 });
};


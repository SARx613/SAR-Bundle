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
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[SAR] Webhook received: ${topic} for ${shop}`);

  const order = payload as unknown as ShopifyOrder;

  // Only process paid orders (webhook topic is already ORDERS_PAID,
  // but we guard against retries with other financial statuses just in case)
  if (order.financial_status !== "paid") {
    return new Response(null, { status: 200 });
  }

  // ── Find line items that contain a SAR bundle ──────────────────────────────
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
    // No SAR bundle in this order — nothing to do
    return new Response(null, { status: 200 });
  }

  console.log(
    `[SAR] Order contains $${bundleRevenue.toFixed(2)} of bundle revenue for ${shop}`,
  );

  // ── Upsert ShopBilling with monthly reset logic ────────────────────────────
  const monthStart = startOfCurrentMonthUTC();

  const existing = await prisma.shopBilling.findUnique({
    where: { shopDomain: shop },
  });

  if (!existing) {
    // First time we see this shop — create record
    await prisma.shopBilling.create({
      data: {
        shopDomain: shop,
        activePlan: "free_tier",
        monthlyBundleRevenue: bundleRevenue,
        revenueResetAt: monthStart,
      },
    });
  } else {
    // Check if we need to reset (new calendar month)
    const needsReset =
      existing.revenueResetAt < monthStart;

    await prisma.shopBilling.update({
      where: { shopDomain: shop },
      data: {
        monthlyBundleRevenue: needsReset
          ? bundleRevenue                              // Reset + this order
          : existing.monthlyBundleRevenue + bundleRevenue, // Accumulate
        revenueResetAt: needsReset ? monthStart : existing.revenueResetAt,
        updatedAt: new Date(),
      },
    });

    if (needsReset) {
      console.log(
        `[SAR] Monthly reset applied for ${shop}. New total: $${bundleRevenue.toFixed(2)}`,
      );
    }
  }

  return new Response(null, { status: 200 });
};

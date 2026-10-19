import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  createUsageRecord,
  startOfCurrentMonthUTC,
  syncShopSubscriptionLineItemId,
} from "../utils/billing.server";

// ─── Types (minimal — Shopify sends a full order object) ─────────────────────

interface OrderProperty {
  name: string;
  value: string;
}

interface DiscountAllocation {
  amount?: string;
}

interface OrderLineItem {
  price: string;
  quantity: number;
  total_discount?: string;
  discount_allocations?: DiscountAllocation[];
  properties: OrderProperty[];
}

interface ShopifyOrder {
  id: number | string;
  financial_status: string;
  line_items: OrderLineItem[];
}

// ─── In-memory idempotency guard (protects against Shopify webhook retries) ──

const processedOrderIds = new Set<string>();
const MAX_PROCESSED_ORDER_IDS = 1000;

function markOrderProcessed(idKey: string): boolean {
  if (!idKey) return false;
  if (processedOrderIds.has(idKey)) return true;
  if (processedOrderIds.size >= MAX_PROCESSED_ORDER_IDS) {
    const oldest = processedOrderIds.values().next().value;
    if (oldest !== undefined) {
      processedOrderIds.delete(oldest);
    }
  }
  processedOrderIds.add(idKey);
  return false;
}

function isBundleLineItem(properties: OrderProperty[] | undefined): boolean {
  if (!Array.isArray(properties)) return false;
  return properties.some((p) => {
    const val = String(p?.value ?? "").trim();
    if (!val) return false;
    return (
      p.name === "_sar_bundle_id" ||
      p.name === "_sar_bundle_config_id" ||
      (p.name === "_sar_bundle_line" && val === "1")
    );
  });
}

function computeLineNetRevenue(item: OrderLineItem): number {
  const unitPrice = parseFloat(item.price ?? "0");
  const qty = item.quantity ?? 1;
  if (isNaN(unitPrice) || qty <= 0) return 0;
  const gross = unitPrice * qty;

  let discount = parseFloat(item.total_discount ?? "0");
  if (isNaN(discount) || discount <= 0) {
    discount = 0;
    if (Array.isArray(item.discount_allocations)) {
      for (const alloc of item.discount_allocations) {
        const amt = parseFloat(alloc?.amount ?? "0");
        if (!isNaN(amt) && amt > 0) discount += amt;
      }
    }
  }

  return Math.max(0, gross - discount);
}

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const webhookIdHeader = request.headers.get("X-Shopify-Webhook-Id") ?? "";
  const { admin, shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[SAR] Webhook received: ${topic} for ${shop}`);

  const order = payload as unknown as ShopifyOrder;

  // Only process paid orders
  if (order.financial_status !== "paid") {
    return new Response(null, { status: 200 });
  }

  const idempotencyKey = String(order.id ?? webhookIdHeader ?? "").trim();
  if (idempotencyKey && markOrderProcessed(`${shop}:${idempotencyKey}`)) {
    console.log(`[SAR] Duplicate order webhook ignored for ${shop} (${idempotencyKey})`);
    return new Response(null, { status: 200 });
  }

  // ── Find line items that contain a SAR bundle
  let bundleRevenue = 0;

  for (const item of order.line_items ?? []) {
    if (isBundleLineItem(item.properties)) {
      bundleRevenue += computeLineNetRevenue(item);
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

  let subscriptionLineItemId = existing.subscriptionLineItemId;
  if (!subscriptionLineItemId && admin) {
    subscriptionLineItemId = await syncShopSubscriptionLineItemId(admin, shop);
  }

  // Threshold 1: 200€
  if (newTotal > 200 && !charged200_update) {
    if (subscriptionLineItemId && admin) {
      const success = await createUsageRecord(
        admin,
        subscriptionLineItemId,
        14.99,
        "Dépassement du seuil de base (200€) — SAR Bundle",
      );
      if (success) charged200_update = true;
    } else {
      console.warn(`[SAR] Reached 200 threshold for ${shop} but no subscriptionLineItemId is stored.`);
    }
  }

  // Threshold 2: 1200€
  if (newTotal > 1200 && !charged1200_update) {
    if (subscriptionLineItemId && admin) {
      const success = await createUsageRecord(
        admin,
        subscriptionLineItemId,
        25.0,
        "Dépassement du seuil pro (1200€) — SAR Bundle",
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
      ...(subscriptionLineItemId ? { subscriptionLineItemId } : {}),
      updatedAt: new Date(),
    },
  });

  if (needsReset) {
    console.log(`[SAR] Monthly reset applied for ${shop}. New total: ${bundleRevenue.toFixed(2)}€`);
  }

  return new Response(null, { status: 200 });
};


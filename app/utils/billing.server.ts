import prisma from "../db.server";
import { BILLING_PLANS } from "./billing-plans";

export function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function getEffectiveShopBilling<
  T extends {
    monthlyBundleRevenue: number;
    charged200: boolean;
    charged1200: boolean;
    revenueResetAt: Date | string;
  },
>(shopBilling: T | null | undefined) {
  if (!shopBilling) {
    return {
      monthlyBundleRevenue: 0,
      charged200: false,
      charged1200: false,
      needsReset: false,
    };
  }
  const monthStart = startOfCurrentMonthUTC();
  const resetAt =
    shopBilling.revenueResetAt instanceof Date
      ? shopBilling.revenueResetAt
      : new Date(shopBilling.revenueResetAt);
  const needsReset = resetAt < monthStart;
  if (needsReset) {
    return {
      ...shopBilling,
      monthlyBundleRevenue: 0,
      charged200: false,
      charged1200: false,
      needsReset: true,
    };
  }
  return {
    ...shopBilling,
    monthlyBundleRevenue: shopBilling.monthlyBundleRevenue ?? 0,
    charged200: shopBilling.charged200 ?? false,
    charged1200: shopBilling.charged1200 ?? false,
    needsReset: false,
  };
}

export async function syncShopSubscriptionLineItemId(
  admin: any,
  shop: string,
): Promise<string | null> {
  try {
    const response = await admin.graphql(
      `#graphql
      query SyncShopSubscriptionLineItem {
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
      }`,
    );
    const data = await response.json();
    const subscriptions =
      data?.data?.currentAppInstallation?.activeSubscriptions || [];

    const sarSub =
      subscriptions.find(
        (s: any) =>
          s.name === BILLING_PLANS.sar_bundle_plan.name ||
          s.name === BILLING_PLANS.sar_bundle_plan.handle,
      ) ??
      subscriptions.find((s: any) =>
        s.lineItems?.some(
          (li: any) => li.plan?.pricingDetails?.__typename === "AppUsagePricing",
        ),
      );

    let usageLineItemId: string | null = null;
    if (sarSub && Array.isArray(sarSub.lineItems)) {
      const usageLineItem = sarSub.lineItems.find(
        (li: any) => li.plan?.pricingDetails?.__typename === "AppUsagePricing",
      );
      if (usageLineItem?.id) {
        usageLineItemId = usageLineItem.id;
      }
    }

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
      console.log(`[SAR/Billing] Stored usage line item ID for ${shop}`);
      return usageLineItemId;
    }

    console.warn(
      `[SAR/Billing] No usage line item ID found for ${shop} — billing might not be active yet.`,
    );
    return null;
  } catch (err) {
    console.error("[SAR/Billing] Failed to sync subscriptionLineItemId:", err);
    return null;
  }
}

export async function createUsageRecord(
  admin: any,
  subscriptionLineItemId: string,
  price: number,
  description: string,
) {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation appUsageRecordCreate($description: String!, $price: MoneyInput!, $subscriptionLineItemId: ID!) {
        appUsageRecordCreate(description: $description, price: $price, subscriptionLineItemId: $subscriptionLineItemId) {
          userErrors { field message }
          appUsageRecord { id }
        }
      }`,
      {
        variables: {
          description,
          price: {
            amount: price,
            currencyCode: "EUR",
          },
          subscriptionLineItemId,
        },
      },
    );

    const data = await response.json();
    const userErrors = data?.data?.appUsageRecordCreate?.userErrors ?? [];
    if (
      data?.errors?.length ||
      userErrors.length > 0 ||
      !data?.data?.appUsageRecordCreate?.appUsageRecord?.id
    ) {
      console.error(
        "[SAR/Billing] Usage record creation failed:",
        data?.errors || userErrors,
      );
      return false;
    }

    console.log(`[SAR/Billing] Created usage record for ${price}€: ${description}`);
    return true;
  } catch (err) {
    console.error("[SAR/Billing] GraphQL error in createUsageRecord:", err);
    return false;
  }
}

import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  await db.session.deleteMany({ where: { shop } });
  await db.shopBilling
    .updateMany({
      where: { shopDomain: shop },
      data: { subscriptionLineItemId: null },
    })
    .catch((err) => {
      console.error(`[SAR] Failed to reset subscriptionLineItemId for ${shop}:`, err);
    });

  return new Response();
};

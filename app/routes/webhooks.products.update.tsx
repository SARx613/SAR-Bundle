import type { ActionFunctionArgs } from "@remix-run/node";
import type { BundleStatus } from "@prisma/client";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Synchronise le statut du bundle quand le produit catalogue est modifié dans Shopify.
 * Évite les boucles : si le statut calculé est déjà celui en base, updateMany ne change rien de critique.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const p = payload as Record<string, unknown>;
  const gid =
    typeof p.admin_graphql_api_id === "string"
      ? p.admin_graphql_api_id
      : p.id != null
        ? `gid://shopify/Product/${String(p.id).replace(/\D/g, "")}`
        : null;
  if (!gid || !shop) {
    return new Response();
  }

  const raw = typeof p.status === "string" ? p.status.toLowerCase() : "";
  const map: Record<string, BundleStatus> = {
    active: "ACTIVE",
    draft: "DRAFT",
    archived: "ARCHIVED",
    unlisted: "UNLISTED",
  };
  const next = map[raw];
  if (!next) {
    return new Response();
  }

  await prisma.bundle.updateMany({
    where: { shopDomain: shop, shopifyProductId: gid },
    data: { status: next },
  });

  return new Response();
};

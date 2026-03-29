import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate, unauthenticated } from "../shopify.server";
import { bundleDetailInclude, serializeBundleTree } from "../utils/bundle.server";
import { enrichBundleStepProductsForStorefront } from "../utils/storefront-bundle-enrich.server";

/**
 * App Proxy → GET /apps/sar-bundle/api/bundle/:id
 * Query params (added by Shopify): shop, signature, timestamp, …
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    return json({ error: "Missing shop" }, { status: 400 });
  }

  const id = params.id?.trim();
  if (!id) {
    return json({ error: "Missing bundle id" }, { status: 400 });
  }

  try {
    const bundle = await prisma.bundle.findFirst({
      where: {
        shopDomain: shop,
        status: "ACTIVE",
        OR: [{ id }, { bundleUid: id }],
      },
      include: bundleDetailInclude,
    });

    if (!bundle) {
      return json({ error: "Bundle not found" }, { status: 404 });
    }

    try {
      const { admin } = await unauthenticated.admin(shop);
      await enrichBundleStepProductsForStorefront(admin, bundle);
    } catch (e) {
      console.warn("storefront bundle enrich (Admin API)", e);
    }

    return json(serializeBundleTree(bundle), {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.error("storefront bundle proxy", e);
    return json({ error: "Server error" }, { status: 500 });
  }
};

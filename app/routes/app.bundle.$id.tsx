import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Prisma } from "@prisma/client";
import { BundleEditorForm } from "../components/BundleEditorForm";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import type { SerializedBundle } from "../utils/bundle-form.client";
import {
  bundleDetailInclude,
  buildNestedCreates,
  parseBundlePayload,
  serializeBundleTree,
  toPrismaBundleScalars,
} from "../utils/bundle.server";
import { slugifyProductHandle } from "../utils/storefront-design";
import { syncBundleShopifyProduct } from "../utils/shopify-bundle-product.server";

const emptyBundleState: SerializedBundle = {
  id: null,
  bundleUid: null,
  name: "",
  description: null,
  imageUrl: null,
  imageGid: null,
  shopifyProductId: null,
  productHandle: null,
  seoTitle: null,
  seoDescription: null,
  storefrontDesign: null,
  status: "DRAFT",
  pricingScope: "FLAT",
  discountValueType: "PERCENT",
  flatDiscountValue: null,
  showCompareAtPrice: true,
  showFixedPriceOnLoad: false,
  allowZeroTotal: false,
  minTotalItemCount: null,
  maxTotalItemCount: null,
  minBundleCartValue: null,
  maxBundleCartValue: null,
  pricingTiers: [],
  steps: [],
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id;
  if (!id) throw new Response("Missing bundle id", { status: 400 });

  if (id === "new") {
    return json({
      isNew: true as const,
      bundle: emptyBundleState,
      shop: session.shop,
    });
  }

  const bundle = await prisma.bundle.findFirst({
    where: { id, shopDomain: session.shop },
    include: bundleDetailInclude,
  });

  if (!bundle) throw new Response("Not found", { status: 404 });

  return json({
    isNew: false as const,
    bundle: serializeBundleTree(bundle) as unknown as SerializedBundle,
    shop: session.shop,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const id = params.id;
  if (!id) return json({ error: "Missing bundle id" }, { status: 400 });

  if (request.method !== "POST" && request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return json({ error: "Expected Content-Type: application/json" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const payload = parseBundlePayload(body);
    const scalars = toPrismaBundleScalars(session.shop, payload);
    const { pricingTiers, steps } = buildNestedCreates(payload);

    if (id === "new") {
      if (request.method === "PUT") {
        return json({ error: "Cannot PUT on /new; use POST to create" }, { status: 400 });
      }
      const created = await prisma.bundle.create({
        data: {
          ...scalars,
          pricingTiers: { create: pricingTiers },
          steps: { create: steps },
        },
        include: bundleDetailInclude,
      });

      let out = created;
      let warning: string | undefined;
      try {
        const productGid = await syncBundleShopifyProduct(admin, {
          id: created.id,
          name: created.name,
          description: created.description,
          imageUrl: created.imageUrl,
          shopifyProductId: null,
          handle:
            created.productHandle?.trim() ||
            slugifyProductHandle(created.name),
          seoTitle: created.seoTitle,
          seoDescription: created.seoDescription,
          storefrontDesign: created.storefrontDesign ?? {},
        });
        out = await prisma.bundle.update({
          where: { id: created.id },
          data: { shopifyProductId: productGid },
          include: bundleDetailInclude,
        });
      } catch (e) {
        console.error("Bundle product sync (create)", e);
        warning =
          "Bundle enregistré, mais la création du produit Shopify a échoué : " +
          (e instanceof Error ? e.message : String(e));
      }

      return json(
        { ok: true as const, bundle: serializeBundleTree(out), ...(warning ? { warning } : {}) },
        { status: 201 },
      );
    }

    const existing = await prisma.bundle.findFirst({
      where: { id, shopDomain: session.shop },
      select: { id: true, shopifyProductId: true },
    });
    if (!existing) return json({ error: "Not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.bundlePricingTier.deleteMany({ where: { bundleId: id } });
      await tx.bundleStep.deleteMany({ where: { bundleId: id } });
      await tx.bundle.update({
        where: { id },
        data: {
          ...scalars,
          pricingTiers: { create: pricingTiers },
          steps: { create: steps },
        },
      });
    });

    let updated = await prisma.bundle.findFirstOrThrow({
      where: { id, shopDomain: session.shop },
      include: bundleDetailInclude,
    });

    let warning: string | undefined;
    try {
      const productGid = await syncBundleShopifyProduct(admin, {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        imageUrl: updated.imageUrl,
        shopifyProductId: updated.shopifyProductId,
        handle:
          updated.productHandle?.trim() ||
          slugifyProductHandle(updated.name),
        seoTitle: updated.seoTitle,
        seoDescription: updated.seoDescription,
        storefrontDesign: updated.storefrontDesign ?? {},
      });
      if (productGid !== updated.shopifyProductId) {
        updated = await prisma.bundle.update({
          where: { id: updated.id },
          data: { shopifyProductId: productGid },
          include: bundleDetailInclude,
        });
      }
    } catch (e) {
      console.error("Bundle product sync (update)", e);
      warning =
        "Bundle enregistré, mais la synchronisation du produit Shopify a échoué : " +
        (e instanceof Error ? e.message : String(e));
    }

    return json({
      ok: true as const,
      bundle: serializeBundleTree(updated),
      ...(warning ? { warning } : {}),
    });
  } catch (e) {
    if (e instanceof Response) throw e;
    if (e instanceof Prisma.PrismaClientValidationError) {
      return json({ error: "Validation error", details: e.message }, { status: 400 });
    }
    console.error("bundle save error", e);
    return json({ error: "Failed to save bundle" }, { status: 500 });
  }
};

export default function AppBundleDetail() {
  const { isNew, bundle, shop } = useLoaderData<typeof loader>();
  return <BundleEditorForm isNew={isNew} bundle={bundle} shopDomain={shop} />;
}

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { PRODUCT_DISPLAY_FIELDS, VARIANT_DISPLAY_FIELDS } from "../utils/shopify-graphql-fragments";

/**
 * Admin-only helper to backfill missing StepProduct.productHandle for an existing bundle,
 * without requiring a full “save bundle” from the editor.
 *
 * POST /api/bundle-backfill-handles
 * body: { bundleId: string }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    return json({ error: "Expected Content-Type: application/json" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { bundleId?: unknown } | null;
  const bundleId = typeof body?.bundleId === "string" ? body.bundleId.trim() : "";
  if (!bundleId) return json({ error: "Missing bundleId" }, { status: 400 });

  const steps = await prisma.bundleStep.findMany({
    where: { bundleId, bundle: { shopDomain: session.shop } },
    select: {
      id: true,
      products: {
        select: { id: true, variantGid: true, productHandle: true },
      },
    },
  });

  const missing = steps
    .flatMap((s) => s.products)
    .filter((p) => !p.productHandle?.trim() && p.variantGid?.trim())
    .map((p) => p.variantGid.trim());

  const uniqueIds = Array.from(new Set(missing));
  if (uniqueIds.length === 0) return json({ ok: true as const, updated: 0 });

  const res = await admin.graphql(
    `#graphql
      query BackfillVariantHandles($ids: [ID!]!) {
        ${PRODUCT_DISPLAY_FIELDS}
        ${VARIANT_DISPLAY_FIELDS}
        nodes(ids: $ids) {
          ... on ProductVariant {
            ...VariantDisplayFields
          }
        }
      }`,
    { variables: { ids: uniqueIds } },
  );
  const gql = await res.json();
  const nodes = Array.isArray(gql?.data?.nodes) ? gql.data.nodes : [];

  const handleByVariantId = new Map<string, string>();
  for (const n of nodes) {
    const id = n?.id;
    const handle = n?.product?.handle;
    if (typeof id === "string" && typeof handle === "string" && handle.trim()) {
      handleByVariantId.set(id, handle.trim());
    }
  }

  const updates: Array<{ id: string; handle: string }> = [];
  for (const s of steps) {
    for (const p of s.products) {
      if (p.productHandle?.trim()) continue;
      const h = p.variantGid ? handleByVariantId.get(p.variantGid.trim()) : null;
      if (h) updates.push({ id: p.id, handle: h });
    }
  }

  if (updates.length === 0) return json({ ok: true as const, updated: 0 });

  await prisma.$transaction(
    updates.map((u) =>
      prisma.stepProduct.update({
        where: { id: u.id },
        data: { productHandle: u.handle },
      }),
    ),
  );

  return json({ ok: true as const, updated: updates.length });
};


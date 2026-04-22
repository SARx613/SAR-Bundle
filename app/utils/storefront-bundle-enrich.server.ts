import type { BundleWithDetail } from "./bundle.server";
import { PRODUCT_DISPLAY_FIELDS, VARIANT_DISPLAY_FIELDS } from "./shopify-graphql-fragments";

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type StepProductStorefrontMeta = {
  productTitle: string;
  variantTitle: string;
  displayTitle: string;
  imageUrl: string | null;
  /** Montant décimal (ex. "19.99") depuis l’Admin */
  priceAmount: string | null;
  currencyCode: string | null;
  compareAtAmount: string | null;
  /** Handle Shopify pour /products/{handle}.js (peut compléter l’admin) */
  productHandle: string | null;
};

const CHUNK = 50;

/**
 * Enrichit chaque StepProduct avec titres, image et prix issus de l’API Admin
 * (évite « Default Title » et images manquantes du endpoint variant.js storefront).
 */
export async function enrichBundleStepProductsForStorefront(
  admin: AdminGraphql,
  bundle: BundleWithDetail,
): Promise<void> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of bundle.steps) {
    for (const p of step.products) {
      const g = p.variantGid?.trim();
      if (g && !seen.has(g)) {
        seen.add(g);
        ids.push(g);
      }
    }
  }
  if (!ids.length) return;

  const byVariantId = new Map<string, StepProductStorefrontMeta>();

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const res = await admin.graphql(
      `${PRODUCT_DISPLAY_FIELDS}
      ${VARIANT_DISPLAY_FIELDS}
      query StorefrontBundleVariants($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on ProductVariant {
            ...VariantDisplayFields
          }
        }
      }`,
      { variables: { ids: chunk } },
    );
    const body = await res.json();
    if (body.errors?.length) {
      console.error("storefront enrich variants", body.errors);
      continue;
    }
    const nodes = body.data?.nodes;
    if (!Array.isArray(nodes)) continue;

    for (const node of nodes) {
      if (!node?.id) continue;
      const meta = nodeToMeta(node);
      if (meta) byVariantId.set(node.id, meta);
    }
  }

  for (const step of bundle.steps) {
    for (const p of step.products) {
      const g = p.variantGid?.trim();
      const fromAdmin = g ? byVariantId.get(g) : undefined;
      if (fromAdmin) {
        (p as unknown as { storefront?: StepProductStorefrontMeta }).storefront = fromAdmin;
        // Backfill handle for downstream fallbacks (/products/{handle}.js) when DB value is missing.
        const cur = (p as unknown as { productHandle?: string | null }).productHandle;
        if (!cur?.trim() && fromAdmin.productHandle?.trim()) {
          (p as unknown as { productHandle?: string | null }).productHandle = fromAdmin.productHandle;
        }
      }
    }
  }
}

function nodeToMeta(node: {
  id: string;
  title?: string | null;
  price?: string | null;
  compareAtPrice?: string | null;
  product?: {
    title?: string | null;
    handle?: string | null;
    featuredImage?: { url?: string | null } | null;
  } | null;
  image?: { url?: string | null } | null;
}): StepProductStorefrontMeta | null {
  const productTitle = (node.product?.title ?? "").trim() || "Produit";
  const variantTitle = (node.title ?? "").trim() || "";
  const displayTitle =
    !variantTitle ||
      variantTitle.toLowerCase() === "default title" ||
      variantTitle === "Default Title"
      ? productTitle
      : `${productTitle}`; // – ${variantTitle}`;

  const imageUrl =
    node.image?.url?.trim() ||
    node.product?.featuredImage?.url?.trim() ||
    null;

  const priceAmount = typeof node.price === "string" ? node.price : null;
  const currencyCode = null; // Scalar doesn't include currency Code
  const compareAtAmount = typeof node.compareAtPrice === "string" ? node.compareAtPrice : null;

  return {
    productTitle,
    variantTitle,
    displayTitle,
    imageUrl,
    priceAmount,
    currencyCode,
    compareAtAmount,
    productHandle: node.product?.handle?.trim() || null,
  };
}

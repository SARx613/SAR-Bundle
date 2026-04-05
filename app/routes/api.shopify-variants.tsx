import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { PRODUCT_DISPLAY_FIELDS, VARIANT_DISPLAY_FIELDS } from "../utils/shopify-graphql-fragments";

type VariantMeta = {
  id: string;
  productTitle: string;
  variantTitle: string;
  displayTitle: string;
  imageUrl: string | null;
  currencyCode: string | null;
  priceAmount: string | null;
  productHandle: string | null;
};

function nodeToMeta(node: any): VariantMeta | null {
  if (!node?.id) return null;
  const productTitle = String(node.product?.title ?? "").trim() || "Produit";
  const variantTitle = String(node.title ?? "").trim() || "";
  const displayTitle =
    !variantTitle ||
    variantTitle.toLowerCase() === "default title" ||
    variantTitle === "Default Title"
      ? productTitle
      : `${productTitle} – ${variantTitle}`;
  const imageUrl =
    String(node.image?.url ?? "").trim() ||
    String(node.product?.featuredImage?.url ?? "").trim() ||
    null;
  const priceAmount = node.price?.amount ?? null;
  const currencyCode = node.price?.currencyCode ?? null;
  const productHandle = String(node.product?.handle ?? "").trim() || null;
  return {
    id: node.id,
    productTitle,
    variantTitle,
    displayTitle,
    imageUrl,
    currencyCode,
    priceAmount,
    productHandle,
  };
}

/**
 * Admin API helper for the editor:
 * GET /api/shopify-variants?ids=gid://shopify/ProductVariant/1&ids=gid://shopify/ProductVariant/2
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const ids = url.searchParams
      .getAll("ids")
      .filter(Boolean)
      .filter((id) => id.startsWith("gid://shopify/"));
    if (ids.length === 0) return json({ items: [] as VariantMeta[] });

    const res = await admin.graphql(
      `query EditorVariantMeta($ids: [ID!]!) {
        ${PRODUCT_DISPLAY_FIELDS}
        ${VARIANT_DISPLAY_FIELDS}
        nodes(ids: $ids) {
          ... on ProductVariant {
            ...VariantDisplayFields
          }
        }
      }`,
      { variables: { ids } },
    );
    const body = (await res.json()) as any;
    if (body.errors) {
      console.error("GraphQL errors:", body.errors);
      throw new Error(`GraphQL Error: ${JSON.stringify(body.errors)}`);
    }
    const nodes = body?.data?.nodes;
    const items = Array.isArray(nodes)
      ? nodes.map(nodeToMeta).filter((x): x is VariantMeta => x != null)
      : [];
    return json({ items });
  } catch (err: any) {
    if (err instanceof Response) throw err;
    console.error("api.shopify-variants crash:", err);
    throw new Response(err?.stack || err?.message || String(err), { status: 500, statusText: "API Variants Crash" });
  }
};


import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";

/**
 * Produits d'une collection (ou tous), au format proche de products.json, pour
 * l'APERÇU ADMIN. L'iframe d'aperçu est servie depuis le domaine de l'app : elle
 * ne peut pas charger les produits de la boutique (CORS). Cet endpoint same-origin
 * interroge l'Admin API via le jeton offline du shop (unauthenticated.admin).
 *
 * GET /api/collection-products?shop=xxx.myshopify.com&handle=ma-collection
 *     (handle="all" ou vide => tous les produits)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const handle = (url.searchParams.get("handle") || "").trim();
  if (!shop) return json({ products: [] });

  try {
    const { admin } = await unauthenticated.admin(shop);
    const isAll = !handle || handle === "all";

    const res = isAll
      ? await admin.graphql(
          `#graphql
            query SarAllProducts {
              products(first: 24, sortKey: CREATED_AT, reverse: true) {
                nodes {
                  title handle
                  featuredImage { url }
                  variants(first: 1) { nodes { id price } }
                }
              }
            }`,
        )
      : await admin.graphql(
          `#graphql
            query SarCollectionProducts($handle: String!) {
              collectionByHandle(handle: $handle) {
                products(first: 24) {
                  nodes {
                    title handle
                    featuredImage { url }
                    variants(first: 1) { nodes { id price } }
                  }
                }
              }
            }`,
          { variables: { handle } },
        );

    const body = (await res.json()) as any;
    const nodes = isAll
      ? body?.data?.products?.nodes ?? []
      : body?.data?.collectionByHandle?.products?.nodes ?? [];

    const products = (Array.isArray(nodes) ? nodes : []).map((n: any) => ({
      title: n?.title ?? "",
      handle: n?.handle ?? "",
      images: n?.featuredImage?.url ? [n.featuredImage.url] : [],
      variants: (n?.variants?.nodes ?? []).map((v: any) => ({
        id: v?.id,
        price: v?.price,
      })),
    }));

    return json({ products });
  } catch (e) {
    console.error("[SAR] api.collection-products:", e);
    return json({ products: [] });
  }
};

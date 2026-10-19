import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate, unauthenticated } from "../shopify.server";

/**
 * Produits d'une collection (ou tous), au format proche de products.json, pour
 * l'APERÇU ADMIN. L'iframe d'aperçu est servie depuis le domaine de l'app : elle
 * ne peut pas charger les produits de la boutique (CORS). Cet endpoint same-origin
 * interroge l'Admin API après authentification Admin ou App Proxy.
 *
 * GET /api/collection-products?shop=xxx.myshopify.com&handle=ma-collection
 *     (handle="all" ou vide => tous les produits)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const handle = (url.searchParams.get("handle") || "").trim();

  let admin: any = null;
  try {
    const auth = await authenticate.admin(request);
    admin = auth.admin;
  } catch {
    try {
      const proxyAuth = await authenticate.public.appProxy(request);
      admin = proxyAuth.admin;
      const proxyShop = proxyAuth.session?.shop || shopParam;
      if (!admin && proxyShop) {
        const unauth = await unauthenticated.admin(proxyShop);
        admin = unauth.admin;
      }
    } catch {
      return json({ products: [] }, { status: 401 });
    }
  }

  if (!admin) return json({ products: [] }, { status: 401 });

  try {
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

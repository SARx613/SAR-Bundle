/**
 * Statistiques commerce pour le tableau de bord (Admin GraphQL).
 * - Revenus / commandes : API Orders (lineItems.customAttributes = _sar_bundle_id pour les bundles SAR).
 * - Vues produit : non disponibles via l’API Orders ; réservé à Shopify Analytics / ShopifyQL (read_reports).
 *
 * @see https://shopify.dev/docs/api/admin-graphql/latest/objects/LineItem#field-lineitem-customattributes
 * @see https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
 */

const BUNDLE_LINE_PROP = "_sar_bundle_id";
const ORDERS_PER_PAGE = 100;
const MAX_ORDER_PAGES = 40;

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type CommerceDashboardStats = {
  currencyCode: string;
  /** Somme des discountedTotalSet des lignes ayant la propriété bundle */
  bundleRevenue: number;
  /** Nombre de lignes de commande identifiées comme bundle SAR */
  boxesSold: number;
  avgBoxValue: number | null;
  /** Réservé (Shopify Analytics / ShopifyQL) — pas calculé via Orders */
  bundleProductViews: null;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number | null;
  monthlyBundleRevenue: number;
  truncated: boolean;
  error: string | null;
};

function parseMoneyAmount(amount: string | undefined): number {
  if (amount == null || amount === "") return 0;
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

function isBundleLine(attrs: { key: string; value: string | null }[]): boolean {
  return attrs.some((a) => a.key === BUNDLE_LINE_PROP && (a.value ?? "") !== "");
}

export async function fetchCommerceDashboardStats(
  admin: AdminGraphql,
): Promise<CommerceDashboardStats> {
  const empty = (
    currencyCode: string,
    error: string | null,
  ): CommerceDashboardStats => ({
    currencyCode,
    bundleRevenue: 0,
    boxesSold: 0,
    avgBoxValue: null,
    bundleProductViews: null,
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: null,
    monthlyBundleRevenue: 0,
    truncated: false,
    error,
  });

  let currencyCode = "EUR";

  const shopRes = await admin.graphql(
    `#graphql
      query ShopCurrency {
        shop {
          currencyCode
        }
      }`,
  );
  const shopJson = await shopRes.json();
  const cc = shopJson?.data?.shop?.currencyCode;
  if (typeof cc === "string" && cc) currencyCode = cc;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let cursor: string | null = null;
  let truncated = false;

  let totalRevenue = 0;
  let totalOrders = 0;
  let bundleRevenue = 0;
  let boxesSold = 0;
  let monthlyBundleRevenue = 0;

  try {
    for (let page = 0; page < MAX_ORDER_PAGES; page++) {
      const res = await admin.graphql(
        `#graphql
          query OrdersForDashboard($cursor: String) {
            orders(
              first: ${ORDERS_PER_PAGE}
              after: $cursor
              sortKey: CREATED_AT
              reverse: true
              query: "financial_status:paid"
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  createdAt
                  currentTotalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                  lineItems(first: 150) {
                    edges {
                      node {
                        customAttributes {
                          key
                          value
                        }
                        discountedTotalSet {
                          shopMoney {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
        { variables: { cursor } },
      );

      const body = await res.json();
      if (body.errors?.length) {
        const msg = body.errors.map((e: { message: string }) => e.message).join("; ");
        return empty(currencyCode, msg);
      }

      const conn = body.data?.orders;
      if (!conn) {
        return empty(currencyCode, "Réponse orders invalide");
      }

      for (const edge of conn.edges ?? []) {
        const node = edge.node;
        if (!node) continue;

        const orderTotal = parseMoneyAmount(
          node.currentTotalPriceSet?.shopMoney?.amount,
        );
        const oc = node.currentTotalPriceSet?.shopMoney?.currencyCode;
        if (typeof oc === "string" && oc) currencyCode = oc;

        totalRevenue += orderTotal;
        totalOrders += 1;

        const created = new Date(node.createdAt);
        const inMonth = created >= monthStart;

        for (const liEdge of node.lineItems?.edges ?? []) {
          const li = liEdge.node;
          if (!li) continue;
          const attrs = li.customAttributes ?? [];
          if (!isBundleLine(attrs)) continue;

          const lineAmt = parseMoneyAmount(
            li.discountedTotalSet?.shopMoney?.amount,
          );
          bundleRevenue += lineAmt;
          boxesSold += 1;
          if (inMonth) monthlyBundleRevenue += lineAmt;
        }
      }

      if (!conn.pageInfo?.hasNextPage) break;
      cursor = conn.pageInfo.endCursor;
      if (!cursor) break;
      truncated = page === MAX_ORDER_PAGES - 1;
    }
  } catch (e) {
    return empty(
      currencyCode,
      e instanceof Error ? e.message : String(e),
    );
  }

  const avgOrderValue =
    totalOrders > 0 ? totalRevenue / totalOrders : null;
  const avgBoxValue =
    boxesSold > 0 ? bundleRevenue / boxesSold : null;

  return {
    currencyCode,
    bundleRevenue,
    boxesSold,
    avgBoxValue,
    bundleProductViews: null,
    totalRevenue,
    totalOrders,
    avgOrderValue,
    monthlyBundleRevenue,
    truncated,
    error: null,
  };
}


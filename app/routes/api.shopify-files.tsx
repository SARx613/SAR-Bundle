import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export type ShopifyFileRow = {
  id: string;
  url: string;
  alt: string | null;
};

/**
 * Liste des images hébergées chez Shopify (Admin → Contenu → Fichiers).
 * Nécessite le scope read_files.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const first = Math.min(
    50,
    Math.max(1, Number.parseInt(url.searchParams.get("first") || "30", 10) || 30),
  );

  const res = await admin.graphql(
    `#graphql
      query ShopImageFiles($first: Int!) {
        files(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              __typename
              ... on MediaImage {
                id
                alt
                fileStatus
                image {
                  url
                }
                preview {
                  image {
                    url
                  }
                }
              }
            }
          }
        }
      }`,
    { variables: { first } },
  );

  const body = (await res.json()) as any;
  const errs = body?.errors;
  if (errs?.length) {
    return json(
      {
        ok: false as const,
        error: errs.map((e: { message?: string }) => e.message).join("; "),
      },
      { status: 400 },
    );
  }

  const edges = body?.data?.files?.edges as
    | Array<{
        node?: {
          __typename?: string;
          id?: string;
          alt?: string | null;
          fileStatus?: string;
          image?: { url?: string | null } | null;
          preview?: { image?: { url?: string | null } | null } | null;
        };
      }>
    | undefined;

  const files: ShopifyFileRow[] = [];
  for (const e of edges ?? []) {
    const n = e?.node;
    if (!n || n.__typename !== "MediaImage" || !n.id) continue;
    const u =
      n.image?.url?.trim() ||
      n.preview?.image?.url?.trim() ||
      "";
    if (!u) continue;
    files.push({ id: n.id, url: u, alt: n.alt ?? null });
  }

  return json({ ok: true as const, files });
};

export default function ApiShopifyFilesStub() {
  return (
    <pre>GET avec session admin : liste des MediaImage récents (scope read_files).</pre>
  );
}

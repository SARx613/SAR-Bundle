type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const CHUNK = 50;

/**
 * Returns product handle per Product GID (same order as input chunks).
 */
export async function fetchProductHandlesByGids(
  admin: AdminClient,
  gids: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const valid = [...new Set(gids.filter(Boolean))];
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const res = await admin.graphql(
      `#graphql
        query ProductHandles($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              handle
            }
          }
        }`,
      { variables: { ids: chunk } },
    );
    const body = await res.json();
    const nodes = (body?.data?.nodes ?? []) as Array<{
      id?: string;
      handle?: string;
    } | null>;
    for (let j = 0; j < chunk.length; j++) {
      const gid = chunk[j]!;
      const node = nodes[j];
      out[gid] =
        node && typeof node.handle === "string" && node.handle.length > 0
          ? node.handle
          : null;
    }
  }
  return out;
}

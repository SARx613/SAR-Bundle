type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type BundleProductSyncInput = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  shopifyProductId: string | null;
};

/**
 * Creates or updates a Shopify catalog product (SEO / collections) and sets
 * metafield custom.sar_bundle_id = bundle DB id.
 * Returns the Product GID for Bundle.shopifyProductId.
 */
export async function syncBundleShopifyProduct(
  admin: AdminClient,
  bundle: BundleProductSyncInput,
): Promise<string> {
  const descriptionHtml = bundle.description
    ? `<p>${escapeHtml(bundle.description)}</p>`
    : "";

  const metafields = [
    {
      namespace: "custom",
      key: "sar_bundle_id",
      type: "single_line_text_field",
      value: bundle.id,
    },
  ];

  const media =
    bundle.imageUrl && /^https?:\/\//i.test(bundle.imageUrl)
      ? [
          {
            originalSource: bundle.imageUrl,
            mediaContentType: "IMAGE" as const,
          },
        ]
      : undefined;

  if (bundle.shopifyProductId) {
    // Do not pass media on update (would append duplicates). Image changes: admin Shopify or future media sync.
    const res = await admin.graphql(
      `#graphql
        mutation ProductUpdateBundle($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          product: {
            id: bundle.shopifyProductId,
            title: bundle.name,
            descriptionHtml,
            metafields,
          },
        },
      },
    );
    const body = await res.json();
    const errs = body?.data?.productUpdate?.userErrors;
    if (errs?.length) {
      throw new Error(errs.map((e: { message: string }) => e.message).join("; "));
    }
    const pid = body?.data?.productUpdate?.product?.id;
    if (!pid) throw new Error("productUpdate returned no product id");
    return pid;
  }

  const createRes = await admin.graphql(
    `#graphql
      mutation ProductCreateBundle($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          title: bundle.name,
          descriptionHtml,
          metafields,
        },
        media: media ?? null,
      },
    },
  );
  const createBody = await createRes.json();
  const createErrs = createBody?.data?.productCreate?.userErrors;
  if (createErrs?.length) {
    throw new Error(
      createErrs.map((e: { message: string }) => e.message).join("; "),
    );
  }
  const newId = createBody?.data?.productCreate?.product?.id;
  if (!newId) throw new Error("productCreate returned no product id");
  return newId;
}

/**
 * Removes the catalog product created for a bundle (SEO / collections).
 * Safe to call if the product was already deleted in Shopify.
 */
export async function deleteBundleShopifyProduct(
  admin: AdminClient,
  productGid: string,
): Promise<void> {
  const res = await admin.graphql(
    `#graphql
      mutation ProductDeleteBundle($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: { id: productGid },
      },
    },
  );
  const body = await res.json();
  const errs = body?.data?.productDelete?.userErrors;
  if (errs?.length) {
    const msg = errs.map((e: { message: string }) => e.message).join("; ");
    if (/not found|does not exist|Could not find/i.test(msg)) {
      return;
    }
    throw new Error(msg);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

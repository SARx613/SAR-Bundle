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
  /** Slug Shopify /products/{handle} */
  handle: string;
  seoTitle: string | null;
  seoDescription: string | null;
  /** JSON éditeur visuel (metafield custom.sar_bundle_storefront) */
  storefrontDesign: unknown;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

export type BundleProductSyncResult = {
  productId: string;
  defaultVariantId: string | null;
};

/**
 * Creates or updates a Shopify catalog product (SEO / collections) and sets
 * metafields custom.sar_bundle_id, custom.sar_bundle_storefront, custom.sar_bundle_active.
 * Returns the Product GID and the default variant GID (for Cart Transform merge).
 */
export async function syncBundleShopifyProduct(
  admin: AdminClient,
  bundle: BundleProductSyncInput,
): Promise<BundleProductSyncResult> {
  const descriptionHtml = bundle.description
    ? `<p>${escapeHtml(bundle.description)}</p>`
    : "";

  const storefrontJson = safeJsonStringify(bundle.storefrontDesign ?? {});

  const metafields = [
    {
      namespace: "custom",
      key: "sar_bundle_id",
      type: "single_line_text_field",
      value: bundle.id,
    },
    {
      namespace: "custom",
      key: "sar_bundle_storefront",
      type: "json",
      value: storefrontJson,
    },
    {
      namespace: "custom",
      key: "sar_bundle_active",
      type: "boolean",
      value: bundle.status === "ACTIVE" ? "true" : "false",
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

  const hasSeo = Boolean(
    (bundle.seoTitle && bundle.seoTitle.trim()) ||
      (bundle.seoDescription && bundle.seoDescription.trim()),
  );
  const seo = hasSeo
    ? {
        title: bundle.seoTitle?.trim() ?? "",
        description: bundle.seoDescription?.trim() ?? "",
      }
    : undefined;

  if (bundle.shopifyProductId) {
    const res = await admin.graphql(
      `#graphql
        mutation ProductUpdateBundle($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
              handle
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
            handle: bundle.handle,
            descriptionHtml,
            ...(seo ? { seo } : {}),
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
    const defaultVariantId = await fetchDefaultVariantGid(admin, pid);
    return { productId: pid, defaultVariantId };
  }

  const createRes = await admin.graphql(
    `#graphql
      mutation ProductCreateBundle($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            handle
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
          handle: bundle.handle,
          descriptionHtml,
          ...(seo ? { seo } : {}),
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
  const defaultVariantId = await fetchDefaultVariantGid(admin, newId);
  return { productId: newId, defaultVariantId };
}

async function fetchDefaultVariantGid(
  admin: AdminClient,
  productGid: string,
): Promise<string | null> {
  const res = await admin.graphql(
    `#graphql
      query BundleProductDefaultVariant($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            nodes {
              id
            }
          }
        }
      }`,
    { variables: { id: productGid } },
  );
  const body = await res.json();
  const nodes = body?.data?.product?.variants?.nodes;
  const first = Array.isArray(nodes) ? nodes[0] : null;
  return typeof first?.id === "string" ? first.id : null;
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? {});
  } catch {
    return "{}";
  }
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

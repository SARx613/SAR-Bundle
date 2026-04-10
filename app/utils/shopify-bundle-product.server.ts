type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export function galleryUrlsFromBundle(bundle: {
  bundleGallery: unknown;
  imageUrl: string | null;
}): string[] {
  if (Array.isArray(bundle.bundleGallery)) {
    const urls: string[] = [];
    for (const item of bundle.bundleGallery) {
      if (item && typeof item === "object" && "url" in item) {
        const u = String((item as { url: unknown }).url).trim();
        if (/^https?:\/\//i.test(u)) urls.push(u);
      }
    }
    if (urls.length) return urls;
  }
  if (bundle.imageUrl && /^https?:\/\//i.test(bundle.imageUrl)) {
    return [bundle.imageUrl];
  }
  return [];
}

export type BundleProductSyncInput = {
  id: string;
  name: string;
  description: string | null;
  /** URLs publiques, ordre = galerie produit (1re = principale) */
  galleryUrls: string[];
  shopifyProductId: string | null;
  /** Slug Shopify /products/{handle} */
  handle: string;
  seoTitle: string | null;
  seoDescription: string | null;
  /** JSON éditeur visuel (metafield custom.sar_bundle_storefront) */
  storefrontDesign: unknown;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  /** Quantité d'inventaire à définir sur le variant (null = ne pas modifier) */
  inventoryQuantity?: number | null;
};

/** ProductStatus Admin GraphQL — aligné sur le statut du bundle. */
function shopifyProductStatus(
  status: BundleProductSyncInput["status"],
): "ACTIVE" | "DRAFT" | "ARCHIVED" | "UNLISTED" {
  return status;
}

function bundleActiveForStorefront(status: BundleProductSyncInput["status"]): boolean {
  return status === "ACTIVE" || status === "UNLISTED";
}

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
      value: bundleActiveForStorefront(bundle.status) ? "true" : "false",
    },
  ];

  const mediaInputs = bundle.galleryUrls
    .filter((u) => /^https?:\/\//i.test(u))
    .map((originalSource) => ({
      originalSource,
      mediaContentType: "IMAGE" as const,
    }));
  const media = mediaInputs.length ? mediaInputs : undefined;

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

  const SAR_TAG = "SAR-Bundle";

  if (bundle.shopifyProductId) {
    const res = await admin.graphql(
      `#graphql
        mutation ProductUpdateBundle($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
              handle
              tags
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
            status: shopifyProductStatus(bundle.status),
            tags: [SAR_TAG],
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
    await syncProductGalleryMedia(admin, pid, bundle.galleryUrls);
    const defaultVariantId = await fetchDefaultVariantGid(admin, pid);
    // Apply inventory if specified
    if (bundle.inventoryQuantity != null && defaultVariantId) {
      try {
        await setVariantInventory(admin, pid, defaultVariantId, bundle.inventoryQuantity);
      } catch (e) {
        console.warn("setVariantInventory (non-fatal):", e);
      }
    }
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
          status: shopifyProductStatus(bundle.status),
          tags: [SAR_TAG],
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

  // Publish the newly created product to ALL channels
  try {
    await publishProductToAllChannels(admin, newId);
  } catch (e) {
    console.warn("publishProductToAllChannels (non-fatal):", e);
  }

  const defaultVariantId = await fetchDefaultVariantGid(admin, newId);
  // Apply inventory if specified
  if (bundle.inventoryQuantity != null && defaultVariantId) {
    try {
      await setVariantInventory(admin, newId, defaultVariantId, bundle.inventoryQuantity);
    } catch (e) {
      console.warn("setVariantInventory (non-fatal):", e);
    }
  }
  return { productId: newId, defaultVariantId };
}

/**
 * Réconcilie les images catalogue avec la galerie bundle : supprime les MediaImage
 * existantes puis recrée depuis les URLs (ordre conservé).
 */
async function syncProductGalleryMedia(
  admin: AdminClient,
  productGid: string,
  galleryUrls: string[],
): Promise<void> {
  const urls = galleryUrls.filter((u) => /^https?:\/\//i.test(u));

  const listRes = await admin.graphql(
    `#graphql
      query ProductMediaForSync($id: ID!) {
        product(id: $id) {
          media(first: 50) {
            nodes {
              __typename
              ... on MediaImage {
                id
              }
            }
          }
        }
      }`,
    { variables: { id: productGid } },
  );
  const listBody = await listRes.json();
  const nodes = listBody?.data?.product?.media?.nodes;
  const mediaIds: string[] = [];
  if (Array.isArray(nodes)) {
    for (const n of nodes) {
      if (n?.__typename === "MediaImage" && typeof n.id === "string") {
        mediaIds.push(n.id);
      }
    }
  }

  if (mediaIds.length) {
    const delRes = await admin.graphql(
      `#graphql
        mutation ProductDeleteMediaSync($productId: ID!, $mediaIds: [ID!]!) {
          productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
            deletedMediaIds
            userErrors {
              field
              message
            }
          }
        }`,
      { variables: { productId: productGid, mediaIds } },
    );
    const delBody = await delRes.json();
    const delErrs = delBody?.data?.productDeleteMedia?.userErrors;
    if (delErrs?.length) {
      console.error("productDeleteMedia", delErrs);
    }
  }

  if (!urls.length) return;

  const createRes = await admin.graphql(
    `#graphql
      mutation ProductCreateMediaSync($productId: ID!, $media: [CreateMediaInput!]!) {
        productCreateMedia(productId: $productId, media: $media) {
          media {
            ... on MediaImage {
              id
            }
          }
          mediaUserErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        productId: productGid,
        media: urls.map((originalSource) => ({
          originalSource,
          mediaContentType: "IMAGE",
          alt: "Bundle",
        })),
      },
    },
  );
  const createBody = await createRes.json();
  const mErrs = createBody?.data?.productCreateMedia?.mediaUserErrors;
  if (mErrs?.length) {
    console.error("productCreateMedia", mErrs);
  }
}

/**
 * Met à jour le prix catalogue de la variante « coque » du bundle (ligne panier unique).
 * À appeler après sync produit quand le mode est prix fixe pour que cart/add.js facture le bon montant.
 */
export async function syncFixedPriceBoxCatalogVariantPrice(
  admin: AdminClient,
  params: {
    bundlePricingMode: string;
    flatDiscountValue: string | number | { toString(): string } | null | undefined;
    shopifyProductId: string | null | undefined;
    shopifyParentVariantId: string | null | undefined;
  },
): Promise<void> {
  if (params.bundlePricingMode !== "FIXED_PRICE_BOX") return;
  const raw =
    params.flatDiscountValue == null
      ? ""
      : typeof params.flatDiscountValue === "string"
        ? params.flatDiscountValue
        : String(params.flatDiscountValue);
  const price = raw.trim();
  if (!price || !params.shopifyProductId || !params.shopifyParentVariantId) return;

  const res = await admin.graphql(
    `#graphql
      mutation SarBundleCatalogVariantPrice(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
      ) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        productId: params.shopifyProductId,
        variants: [{ id: params.shopifyParentVariantId, price }],
      },
    },
  );
  const body = await res.json();
  const errs = body?.data?.productVariantsBulkUpdate?.userErrors;
  if (Array.isArray(errs) && errs.length) {
    throw new Error(errs.map((e: { message: string }) => e.message).join("; "));
  }
}

/**
 * Publishes a product to ALL available sales channels.
 */
async function publishProductToAllChannels(
  admin: AdminClient,
  productGid: string,
): Promise<void> {
  const pubRes = await admin.graphql(
    `#graphql
      query FetchAllPublications {
        publications(first: 50) {
          nodes {
            id
            name
          }
        }
      }`,
  );
  const pubBody = await pubRes.json();
  const publications: Array<{ id: string; name: string }> =
    pubBody?.data?.publications?.nodes ?? [];

  if (publications.length === 0) {
    console.warn("publishProductToAllChannels: no publications found");
    return;
  }

  const publishRes = await admin.graphql(
    `#graphql
      mutation PublishBundleProductAll($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          publishable {
            ... on Product { id }
          }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        id: productGid,
        input: publications.map((p) => ({ publicationId: p.id })),
      },
    },
  );
  const publishBody = await publishRes.json();
  const publishErrs = publishBody?.data?.publishablePublish?.userErrors;
  if (publishErrs?.length) {
    console.warn(
      "publishablePublish userErrors:",
      publishErrs.map((e: { message: string }) => e.message).join("; "),
    );
  }
}

/**
 * Sets the inventory quantity on a variant using inventorySetOnHandQuantities.
 */
async function setVariantInventory(
  admin: AdminClient,
  productGid: string,
  variantGid: string,
  quantity: number,
): Promise<void> {
  // Get the inventory item ID for the variant
  const varRes = await admin.graphql(
    `#graphql
      query GetInventoryItem($variantId: ID!) {
        productVariant(id: $variantId) {
          inventoryItem {
            id
            tracked
          }
        }
      }`,
    { variables: { variantId: variantGid } },
  );
  const varBody = await varRes.json();
  const inventoryItemId = varBody?.data?.productVariant?.inventoryItem?.id;
  if (!inventoryItemId) {
    console.warn("setVariantInventory: no inventoryItem found for variant", variantGid);
    return;
  }

  // Get the first location
  const locRes = await admin.graphql(
    `#graphql
      query GetFirstLocation {
        locations(first: 1) {
          nodes { id name }
        }
      }`,
  );
  const locBody = await locRes.json();
  const locationId = locBody?.data?.locations?.nodes?.[0]?.id;
  if (!locationId) {
    console.warn("setVariantInventory: no location found");
    return;
  }

  // Enable tracking if not already tracked
  if (!varBody?.data?.productVariant?.inventoryItem?.tracked) {
    await admin.graphql(
      `#graphql
        mutation EnableTracking($id: ID!) {
          inventoryItemUpdate(id: $id, input: { tracked: true }) {
            inventoryItem { id }
            userErrors { field message }
          }
        }`,
      { variables: { id: inventoryItemId } },
    );
  }

  const setRes = await admin.graphql(
    `#graphql
      mutation SetInventory($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { field message }
        }
      }`,
    {
      variables: {
        input: {
          reason: "correction",
          setQuantities: [
            {
              inventoryItemId,
              locationId,
              quantity,
            },
          ],
        },
      },
    },
  );
  const setBody = await setRes.json();
  const setErrs = setBody?.data?.inventorySetOnHandQuantities?.userErrors;
  if (setErrs?.length) {
    console.warn("inventorySetOnHandQuantities errors:", setErrs.map((e: { message: string }) => e.message).join("; "));
  }
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

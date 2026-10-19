import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  EmptyState,
  Badge,
  Button,
  Box,
  BlockStack,
  InlineGrid,
  Thumbnail,
  Modal,
  TextField,

  useIndexResourceState,
  INDEX_TABLE_SELECT_ALL_ITEMS,
} from "@shopify/polaris";
import {
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
  ExternalIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";

import prisma from "../db.server";
import styles from "../styles/app.bundles.module.css";
import { authenticate } from "../shopify.server";
import { duplicateBundle } from "../utils/bundle.server";
import {
  deleteBundleShopifyProduct,
  galleryUrlsFromBundle,
  syncBundleShopifyProduct,
  syncFixedPriceBoxCatalogVariantPrice,
} from "../utils/shopify-bundle-product.server";
import { Prisma } from "@prisma/client";
import {
   slugifyProductHandle,
  seededStorefrontDesign,
  newBlockId,
  type StorefrontDesignV2,
} from "../utils/storefront-design";
import { fetchProductHandlesByGids } from "../utils/shopify-product-lookup.server";

type BundleTemplateId = "fixed_box" | "multi_step" | "tiered" | "classic";

const BUNDLE_TEMPLATES: Array<{
  id: BundleTemplateId;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
}> = [
  {
    id: "fixed_box",
    icon: "📦",
    title: "Coffret à Prix Fixe",
    subtitle: "Prix fixe 49,90 € pour exactement 3 articles au choix.",
    badge: "3 produits = 49,90 €",
  },
  {
    id: "multi_step",
    icon: "🪜",
    title: "Parcours Multi-Étapes (Routine / Menu)",
    subtitle: "3 étapes guidées (Base, Complément, Finition + Options) avec -15 %.",
    badge: "3 étapes · -15 %",
  },
  {
    id: "tiered",
    icon: "📈",
    title: "Pack Dégressif par Paliers",
    subtitle: "Plus le client achète, plus il économise (2 = -10 %, 3 = -15 %, 4+ = -20 %).",
    badge: "3 paliers progressifs",
  },
  {
    id: "classic",
    icon: "✨",
    title: "Bundle Classique sur-mesure",
    subtitle: "Sélection libre sur 1 étape avec remise globale de 10 %.",
    badge: "1 étape · -10 %",
  },
];

function buildMultiStepDesign(): StorefrontDesignV2 {
  const base = seededStorefrontDesign();
  const headingStyle = {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center" as const,
    marginTop: "0",
    marginBottom: "0.5rem",
  };
  const textStyle = {
    fontSize: "1rem",
    color: "#6b7280",
    textAlign: "center" as const,
    marginTop: "0",
    marginBottom: "1.25rem",
  };
  return {
    ...base,
    stepDesigns: {
      "0": [
        { id: newBlockId(), type: "heading", text: "Étape 1 : Votre base", tag: "h2", style: headingStyle },
        { id: newBlockId(), type: "text", text: "Sélectionnez le produit principal de votre routine.", style: textStyle },
        { id: newBlockId(), type: "product_list", source: "all_products", cardLayout: "classic", columns: 3, columnsMobile: 2 },
      ],
      "1": [
        { id: newBlockId(), type: "heading", text: "Étape 2 : Votre complément", tag: "h2", style: headingStyle },
        { id: newBlockId(), type: "text", text: "Ajoutez un produit complémentaire adapté à vos besoins.", style: textStyle },
        { id: newBlockId(), type: "product_list", source: "all_products", cardLayout: "classic", columns: 3, columnsMobile: 2 },
      ],
      "2": [
        { id: newBlockId(), type: "heading", text: "Étape 3 : Finition & Options", tag: "h2", style: headingStyle },
        { id: newBlockId(), type: "text", text: "Personnalisez et finalisez votre sélection.", style: textStyle },
        { id: newBlockId(), type: "product_list", source: "all_products", cardLayout: "classic", columns: 3, columnsMobile: 2 },
        { id: newBlockId(), type: "upsell", title: "Options supplémentaires", behavior: "multiple", items: [] },
      ],
    },
  };
}

function buildCreateDataForTemplate(
  shopDomain: string,
  trimmedName: string,
  templateId: BundleTemplateId,
): Prisma.BundleCreateInput {
  const baseHandle = slugifyProductHandle(trimmedName);

  if (templateId === "fixed_box") {
    const design = seededStorefrontDesign();
    if (design.stepDesigns?.["0"]?.[0]?.type === "heading") {
      design.stepDesigns["0"][0].text = "Choisissez vos 3 produits";
    }
    return {
      shopDomain,
      name: trimmedName,
      productHandle: baseHandle,
      status: "DRAFT",
      bundlePricingMode: "FIXED_PRICE_BOX",
      pricingScope: "FLAT",
      discountValueType: "FIXED_PRICE",
      flatDiscountValue: new Prisma.Decimal("49.90"),
      fixedBoxItemCount: 3,
      showFixedPriceOnLoad: true,
      storefrontDesign: design as unknown as Prisma.InputJsonValue,
      steps: {
        create: [
          {
            sortOrder: 0,
            name: "Choisissez vos 3 produits",
            isFinalStep: true,
            rules: {
              create: [
                {
                  sortOrder: 0,
                  metric: "TOTAL_ITEM_COUNT",
                  operator: "EQ",
                  value: new Prisma.Decimal("3"),
                },
              ],
            },
          },
        ],
      },
    };
  }

  if (templateId === "multi_step") {
    return {
      shopDomain,
      name: trimmedName,
      productHandle: baseHandle,
      status: "DRAFT",
      bundlePricingMode: "STANDARD",
      pricingScope: "FLAT",
      discountValueType: "PERCENT",
      flatDiscountValue: new Prisma.Decimal("15"),
      storefrontDesign: buildMultiStepDesign() as unknown as Prisma.InputJsonValue,
      steps: {
        create: [
          { sortOrder: 0, name: "Étape 1 : Votre base", isFinalStep: false },
          { sortOrder: 1, name: "Étape 2 : Votre complément", isFinalStep: false },
          { sortOrder: 2, name: "Étape 3 : Finition & Options", isFinalStep: true },
        ],
      },
    };
  }

  if (templateId === "tiered") {
    return {
      shopDomain,
      name: trimmedName,
      productHandle: baseHandle,
      status: "DRAFT",
      bundlePricingMode: "TIERED",
      pricingScope: "TIERED",
      discountValueType: "PERCENT",
      storefrontDesign: seededStorefrontDesign() as unknown as Prisma.InputJsonValue,
      pricingTiers: {
        create: [
          {
            sortOrder: 0,
            thresholdBasis: "ITEM_COUNT",
            thresholdMin: new Prisma.Decimal("2"),
            thresholdMax: new Prisma.Decimal("2"),
            tierValue: new Prisma.Decimal("10"),
          },
          {
            sortOrder: 1,
            thresholdBasis: "ITEM_COUNT",
            thresholdMin: new Prisma.Decimal("3"),
            thresholdMax: new Prisma.Decimal("3"),
            tierValue: new Prisma.Decimal("15"),
          },
          {
            sortOrder: 2,
            thresholdBasis: "ITEM_COUNT",
            thresholdMin: new Prisma.Decimal("4"),
            thresholdMax: null,
            tierValue: new Prisma.Decimal("20"),
          },
        ],
      },
      steps: {
        create: [
          { sortOrder: 0, name: "Choisissez vos produits", isFinalStep: true },
        ],
      },
    };
  }

  return {
    shopDomain,
    name: trimmedName,
    productHandle: baseHandle,
    status: "DRAFT",
    bundlePricingMode: "STANDARD",
    pricingScope: "FLAT",
    discountValueType: "PERCENT",
    flatDiscountValue: new Prisma.Decimal("10"),
    storefrontDesign: seededStorefrontDesign() as unknown as Prisma.InputJsonValue,
    steps: {
      create: [
        { sortOrder: 0, name: "Choisissez vos produits", isFinalStep: true },
      ],
    },
  };
}

type BundleRow = {
  id: string;
  name: string;
  status: string;
  imageUrl: string | null;
  shopifyProductId: string | null;
  productHandle: string | null;
  /** Lien absolu (nouvel onglet) */
  storefrontProductUrl: string | null;
  /** Affichage : chemin seul, ex. /products/mon-handle */
  storefrontPath: string | null;
  createdAt: string;
  updatedAt: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const [rows, totalCount, activeCount, draftCount] = await Promise.all([
    prisma.bundle.findMany({
      where: { shopDomain: shop },
      select: {
        id: true,
        name: true,
        status: true,
        imageUrl: true,
        shopifyProductId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.bundle.count({ where: { shopDomain: shop } }),
    prisma.bundle.count({ where: { shopDomain: shop, status: "ACTIVE" } }),
    prisma.bundle.count({ where: { shopDomain: shop, status: "DRAFT" } }),
  ]);

  const gids = rows
    .map((r) => r.shopifyProductId)
    .filter((id): id is string => Boolean(id));

  let handleByGid: Record<string, string | null> = {};
  try {
    handleByGid = await fetchProductHandlesByGids(admin, gids);
  } catch (e) {
    console.error("fetchProductHandlesByGids", e);
  }

  const bundles: BundleRow[] = rows.map((b) => {
    const handle =
      b.shopifyProductId && handleByGid[b.shopifyProductId] !== undefined
        ? handleByGid[b.shopifyProductId]
        : null;
    const storefrontProductUrl =
      handle && handle.length > 0
        ? `https://${shop}/products/${handle}`
        : null;
    const storefrontPath =
      handle && handle.length > 0 ? `/products/${handle}` : null;
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      imageUrl: b.imageUrl,
      shopifyProductId: b.shopifyProductId,
      productHandle: handle,
      storefrontProductUrl,
      storefrontPath,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  });

  return json({ bundles, shop, stats: { total: totalCount, active: activeCount, draft: draftCount } });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name");
    if (typeof name !== "string" || !name.trim()) {
      return json({ error: "Identifiant manquant" }, { status: 400 });
    }
    const rawTemplate = formData.get("template");
    const templateId: BundleTemplateId =
      rawTemplate === "fixed_box" ||
      rawTemplate === "multi_step" ||
      rawTemplate === "tiered" ||
      rawTemplate === "classic"
        ? rawTemplate
        : "classic";

    const created = await prisma.bundle.create({
      data: buildCreateDataForTemplate(session.shop, name.trim(), templateId),
    });

    try {
      const sync = await syncBundleShopifyProduct(admin, {
        id: created.id,
        name: created.name,
        description: created.description,
        galleryUrls: galleryUrlsFromBundle({
          bundleGallery: created.bundleGallery,
          imageUrl: created.imageUrl,
        }),
        shopifyProductId: null,
        handle:
          created.productHandle?.trim() ||
          slugifyProductHandle(created.name),
        seoTitle: created.seoTitle,
        seoDescription: created.seoDescription,
        storefrontDesign: created.storefrontDesign ?? {},
        status: created.status,
      });
      const updated = await prisma.bundle.update({
        where: { id: created.id },
        data: {
          shopifyProductId: sync.productId,
          ...(sync.defaultVariantId
            ? { shopifyParentVariantId: sync.defaultVariantId }
            : {}),
        },
      });
      await syncFixedPriceBoxCatalogVariantPrice(admin, {
        bundlePricingMode: updated.bundlePricingMode,
        flatDiscountValue: updated.flatDiscountValue,
        shopifyProductId: updated.shopifyProductId,
        shopifyParentVariantId: updated.shopifyParentVariantId,
      });
    } catch (e) {
      console.error("create bundle product sync", e);
    }

    return redirect(`/app/bundle/${created.id}`);
  }

  if (intent === "delete") {
    const bundleId = formData.get("bundleId");
    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return json({ error: "Identifiant manquant" }, { status: 400 });
    }
    const existing = await prisma.bundle.findFirst({
      where: { id: bundleId, shopDomain: session.shop },
      select: { id: true, shopifyProductId: true },
    });
    if (!existing) {
      return json({ error: "Bundle introuvable" }, { status: 404 });
    }
    if (existing.shopifyProductId) {
      try {
        await deleteBundleShopifyProduct(admin, existing.shopifyProductId);
      } catch (e) {
        console.error("deleteBundleShopifyProduct", e);
      }
    }
    await prisma.bundle.delete({ where: { id: bundleId } });
    return json({ ok: true as const });
  }

  if (intent === "bulk_delete") {
    const ids = formData
      .getAll("ids")
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    if (ids.length === 0) {
      return json({ error: "Aucune sélection" }, { status: 400 });
    }
    const found = await prisma.bundle.findMany({
      where: { shopDomain: session.shop, id: { in: ids } },
      select: { id: true, shopifyProductId: true },
    });
    for (const row of found) {
      if (row.shopifyProductId) {
        try {
          await deleteBundleShopifyProduct(admin, row.shopifyProductId);
        } catch (e) {
          console.error("deleteBundleShopifyProduct bulk", e);
        }
      }
    }
    await prisma.bundle.deleteMany({
      where: { shopDomain: session.shop, id: { in: found.map((f) => f.id) } },
    });
    return json({ ok: true as const, deleted: found.length });
  }

  if (intent === "duplicate") {
    const bundleId = formData.get("bundleId");
    if (typeof bundleId !== "string" || !bundleId.trim()) {
      return json({ error: "Identifiant manquant" }, { status: 400 });
    }
    let newId: string;
    try {
      const out = await duplicateBundle(prisma, session.shop, bundleId);
      newId = out.id;
    } catch (e) {
      if (e instanceof Response) throw e;
      throw e;
    }
    const bundle = await prisma.bundle.findFirst({
      where: { id: newId, shopDomain: session.shop },
    });
    if (bundle) {
      try {
        const sync = await syncBundleShopifyProduct(admin, {
          id: bundle.id,
          name: bundle.name,
          description: bundle.description,
          galleryUrls: galleryUrlsFromBundle({
            bundleGallery: bundle.bundleGallery,
            imageUrl: bundle.imageUrl,
          }),
          shopifyProductId: null,
          handle:
            bundle.productHandle?.trim() ||
            slugifyProductHandle(bundle.name),
          seoTitle: bundle.seoTitle,
          seoDescription: bundle.seoDescription,
          storefrontDesign: bundle.storefrontDesign ?? {},
          status: bundle.status,
        });
        await prisma.bundle.update({
          where: { id: newId },
          data: {
            shopifyProductId: sync.productId,
            ...(sync.defaultVariantId
              ? { shopifyParentVariantId: sync.defaultVariantId }
              : {}),
          },
        });
        const dupAfter = await prisma.bundle.findFirst({
          where: { id: newId, shopDomain: session.shop },
        });
        if (dupAfter) {
          try {
            await syncFixedPriceBoxCatalogVariantPrice(admin, {
              bundlePricingMode: dupAfter.bundlePricingMode,
              flatDiscountValue: dupAfter.flatDiscountValue,
              shopifyProductId: dupAfter.shopifyProductId,
              shopifyParentVariantId: dupAfter.shopifyParentVariantId,
            });
          } catch (e) {
            console.error("duplicate bundle catalog variant price", e);
          }
        }
      } catch (e) {
        console.error("duplicate bundle product sync", e);
      }
    }
    return redirect(`/app/bundle/${newId}`);
  }

  return json({ error: "Action inconnue" }, { status: 400 });
};

const statusTone: Record<
  string,
  "info" | "success" | "attention" | "warning" | "critical" | "new" | "read-only"
> = {
  DRAFT: "info",
  ACTIVE: "success",
  UNLISTED: "attention",
  ARCHIVED: "read-only",
};

const dateFmt: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

export default function AppBundles() {
  const { bundles, stats } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<BundleTemplateId>("fixed_box");

  // ── UI optimiste : retire immédiatement les bundles en cours de suppression ──
  // (sinon il faut attendre la revalidation du loader, ralentie par l'appel
  //  Shopify fetchProductHandlesByGids → impression que « rien ne se passe »).
  const pendingDeleteIds = useMemo(() => {
    const fd = fetcher.formData;
    if (!fd) return new Set<string>();
    const intent = fd.get("intent");
    if (intent === "delete") {
      const id = fd.get("bundleId");
      return typeof id === "string" ? new Set([id]) : new Set<string>();
    }
    if (intent === "bulk_delete") {
      return new Set(
        fd.getAll("ids").filter((v): v is string => typeof v === "string"),
      );
    }
    return new Set<string>();
  }, [fetcher.formData]);

  const visibleBundles = useMemo(
    () => bundles.filter((b) => !pendingDeleteIds.has(b.id)),
    [bundles, pendingDeleteIds],
  );

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(visibleBundles);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data = fetcher.data as { ok?: boolean } | undefined;
    if (data?.ok) clearSelection();
  }, [fetcher.state, fetcher.data, clearSelection]);

  const submitCreate = useCallback(() => {
    const fd = new FormData();
    fd.append("intent", "create");
    fd.append("name", createName);
    fd.append("template", selectedTemplate);
    fetcher.submit(fd, { method: "post", action: "/app/bundles" });
    setCreateModalOpen(false);
    setCreateName("");
  }, [fetcher, createName, selectedTemplate]);

  const submitDelete = useCallback(
    (bundleId: string) => {
      fetcher.submit(
        { intent: "delete", bundleId },
        { method: "post", action: "/app/bundles" },
      );
    },
    [fetcher],
  );

  const submitDuplicate = useCallback(
    (bundleId: string) => {
      fetcher.submit(
        { intent: "duplicate", bundleId },
        { method: "post", action: "/app/bundles" },
      );
    },
    [fetcher],
  );

  const submitBulkDelete = useCallback(() => {
    if (selectedResources.length === 0) return;
    const fd = new FormData();
    fd.append("intent", "bulk_delete");
    for (const id of selectedResources) {
      fd.append("ids", id);
    }
    fetcher.submit(fd, { method: "post", action: "/app/bundles" });
  }, [fetcher, selectedResources]);

  const resourceName = {
    singular: "bundle",
    plural: "bundles",
  };

  const rowMarkup = visibleBundles.map((b, index) => (
    <IndexTable.Row
      id={b.id}
      key={b.id}
      position={index}
      selected={selectedResources.includes(b.id)}
      onClick={() => navigate(`/app/bundle/${b.id}`)}
    >
      <IndexTable.Cell>
        {b.imageUrl ? (
          <Thumbnail source={b.imageUrl} alt="" size="small" />
        ) : (
          <Box
            background="bg-surface-secondary"
            minWidth="40px"
            minHeight="40px"
            borderRadius="200"
          />
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button variant="plain" onClick={() => navigate(`/app/bundle/${b.id}`)}>
          {b.name}
        </Button>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {b.storefrontPath ? (
          <Text as="span" variant="bodySm" breakWord>
            {b.storefrontPath}
          </Text>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">
            {b.shopifyProductId
              ? "Produit pas encore publié"
              : "Enregistrez pour créer la page produit"}
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={statusTone[b.status] ?? "info"}>{b.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <span className={styles.actionWrap}>
            <Button
              icon={EditIcon}
              variant="secondary"
              size="large"
              onClick={() => navigate(`/app/bundle/${b.id}`)}
              accessibilityLabel="Modifier"
            />
          </span>
          <span className={styles.actionWrap}>
            <Button
              icon={DuplicateIcon}
              variant="secondary"
              size="large"
              onClick={() => submitDuplicate(b.id)}
              accessibilityLabel="Dupliquer"
            />
          </span>
          <span
            className={`${styles.actionWrap} ${styles.actionWrapCritical}`}
          >
            <Button
              icon={DeleteIcon}
              variant="secondary"
              size="large"
              tone="critical"
              onClick={() => submitDelete(b.id)}
              accessibilityLabel="Supprimer"
            />
          </span>
          {b.storefrontProductUrl ? (
            <span className={styles.actionWrap}>
              <Button
                icon={ExternalIcon}
                variant="secondary"
                size="large"
                url={b.storefrontProductUrl}
                external
                target="_blank"
                accessibilityLabel="Voir la page produit sur la boutique"
              />
            </span>
          ) : (
            <span className={styles.actionWrap}>
              <Button
                icon={ExternalIcon}
                variant="secondary"
                size="large"
                disabled
                accessibilityLabel="Voir la page produit (indisponible)"
              />
            </span>
          )}
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {new Date(b.createdAt).toLocaleString("fr-FR", dateFmt)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {new Date(b.updatedAt).toLocaleString("fr-FR", dateFmt)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page fullWidth>
      <TitleBar title="SAR Bundles">
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
        >
          Créer un bundle
        </button>
      </TitleBar>
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <Card padding="400">
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Total</Text>
              <Text as="p" variant="headingXl">{stats.total}</Text>
            </BlockStack>
          </Card>
          <Card padding="400">
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Actifs</Text>
              <Text as="p" variant="headingXl" tone="success">{stats.active}</Text>
            </BlockStack>
          </Card>
          <Card padding="400">
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">Brouillons</Text>
              <Text as="p" variant="headingXl">{stats.draft}</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card padding="0">
              {visibleBundles.length === 0 ? (
                <Box padding="400"><EmptyState
                  heading="Créez votre premier bundle"
                  action={{
                    content: "Créer un bundle",
                    onAction: () => setCreateModalOpen(true),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    Les bundles par étapes apparaîtront ici une fois configurés.
                  </p>
                </EmptyState></Box>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={visibleBundles.length}
                  selectable
                  selectedItemsCount={
                    allResourcesSelected
                      ? INDEX_TABLE_SELECT_ALL_ITEMS
                      : selectedResources.length
                  }
                  onSelectionChange={handleSelectionChange}
                  promotedBulkActions={[
                    {
                      content: "Supprimer la sélection",
                      onAction: submitBulkDelete,
                    },
                  ]}
                  headings={[
                    { title: "Image" },
                    { title: "Nom" },
                    { title: "Chemin URL" },
                    { title: "Statut" },
                    { title: "Actions" },
                    { title: "Créé le" },
                    { title: "Mis à jour le" },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        <Modal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Créer un nouveau bundle"
          primaryAction={{
            content: "Créer le bundle",
            onAction: submitCreate,
            disabled: !createName.trim(),
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: () => setCreateModalOpen(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label="Nom du bundle"
                value={createName}
                onChange={setCreateName}
                placeholder="Ex. Mon Coffret Découverte"
                autoComplete="off"
                autoFocus
              />
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Choisissez un modèle de départ
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                  {BUNDLE_TEMPLATES.map((tpl) => {
                    const isSelected = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tpl.id)}
                        style={{
                          textAlign: "left",
                          padding: "14px",
                          borderRadius: "12px",
                          border: isSelected
                            ? "2px solid var(--p-color-border-emphasis, #1a1a1a)"
                            : "1px solid var(--p-color-border, #e1e3e5)",
                          background: isSelected
                            ? "var(--p-color-bg-surface-selected, #f4f6f8)"
                            : "var(--p-color-bg-surface, #ffffff)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: "22px", lineHeight: 1 }}>{tpl.icon}</span>
                          <Badge tone={isSelected ? "success" : "info"}>{tpl.badge}</Badge>
                        </div>
                        <Text as="span" variant="bodyMd" fontWeight="bold">
                          {tpl.title}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {tpl.subtitle}
                        </Text>
                      </button>
                    );
                  })}
                </InlineGrid>
              </BlockStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}

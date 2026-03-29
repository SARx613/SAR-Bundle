import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useCallback, useEffect } from "react";
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
  InlineStack,
  Thumbnail,
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
import { authenticate } from "../shopify.server";
import { duplicateBundle } from "../utils/bundle.server";
import { deleteBundleShopifyProduct, syncBundleShopifyProduct } from "../utils/shopify-bundle-product.server";
import { slugifyProductHandle } from "../utils/storefront-design";
import { fetchProductHandlesByGids } from "../utils/shopify-product-lookup.server";

type BundleRow = {
  id: string;
  name: string;
  status: string;
  imageUrl: string | null;
  shopifyProductId: string | null;
  productHandle: string | null;
  storefrontProductUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const rows = await prisma.bundle.findMany({
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
  });

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
    return {
      id: b.id,
      name: b.name,
      status: b.status,
      imageUrl: b.imageUrl,
      shopifyProductId: b.shopifyProductId,
      productHandle: handle,
      storefrontProductUrl,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  });

  return json({ bundles, shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

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
        const gid = await syncBundleShopifyProduct(admin, {
          id: bundle.id,
          name: bundle.name,
          description: bundle.description,
          imageUrl: bundle.imageUrl,
          shopifyProductId: null,
          handle:
            bundle.productHandle?.trim() ||
            slugifyProductHandle(bundle.name),
          seoTitle: bundle.seoTitle,
          seoDescription: bundle.seoDescription,
          storefrontDesign: bundle.storefrontDesign ?? {},
        });
        await prisma.bundle.update({
          where: { id: newId },
          data: { shopifyProductId: gid },
        });
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
  ARCHIVED: "read-only",
};

const dateFmt: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

export default function AppBundles() {
  const { bundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(bundles);

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const data = fetcher.data as { ok?: boolean } | undefined;
    if (data?.ok) clearSelection();
  }, [fetcher.state, fetcher.data, clearSelection]);

  const submitDelete = useCallback(
    (bundleId: string) => {
      if (
        !window.confirm(
          "Supprimer ce bundle ? Le produit catalogue associé sera aussi retiré de Shopify.",
        )
      ) {
        return;
      }
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
    if (
      !window.confirm(
        `Supprimer ${selectedResources.length} bundle(s) ? Les produits catalogue associés seront aussi retirés de Shopify.`,
      )
    ) {
      return;
    }
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

  const rowMarkup = bundles.map((b, index) => (
    <IndexTable.Row
      id={b.id}
      key={b.id}
      position={index}
      selected={selectedResources.includes(b.id)}
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
        {b.storefrontProductUrl ? (
          <Text as="span" variant="bodySm" breakWord>
            {b.storefrontProductUrl}
          </Text>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">
            {b.shopifyProductId
              ? "Handle indisponible"
              : "Pas encore de produit Shopify"}
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={statusTone[b.status] ?? "info"}>{b.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100" wrap={false}>
          <Button
            icon={EditIcon}
            variant="plain"
            onClick={() => navigate(`/app/bundle/${b.id}`)}
            accessibilityLabel="Modifier"
          />
          <Button
            icon={DuplicateIcon}
            variant="plain"
            onClick={() => submitDuplicate(b.id)}
            accessibilityLabel="Dupliquer"
          />
          <Button
            icon={DeleteIcon}
            variant="plain"
            tone="critical"
            onClick={() => submitDelete(b.id)}
            accessibilityLabel="Supprimer"
          />
          {b.storefrontProductUrl ? (
            <Button
              icon={ExternalIcon}
              variant="plain"
              url={b.storefrontProductUrl}
              external
              target="_blank"
              accessibilityLabel="Voir la page produit sur la boutique"
            />
          ) : (
            <Button
              icon={ExternalIcon}
              variant="plain"
              disabled
              accessibilityLabel="Voir la page produit (indisponible)"
            />
          )}
        </InlineStack>
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
    <Page>
      <TitleBar title="SAR Bundles">
        <button
          type="button"
          onClick={() => navigate("/app/bundle/new")}
        >
          Créer un bundle
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card>
            {bundles.length === 0 ? (
              <EmptyState
                heading="Créez votre premier bundle"
                action={{
                  content: "Créer un bundle",
                  onAction: () => navigate("/app/bundle/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Les bundles par étapes apparaîtront ici une fois configurés.
                </p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={bundles.length}
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
                  { title: "URL de la page" },
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
    </Page>
  );
}

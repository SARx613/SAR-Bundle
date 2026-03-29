import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { PackageIcon, PlusIcon } from "@shopify/polaris-icons";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const [total, active, draft] = await Promise.all([
    prisma.bundle.count({ where: { shopDomain: session.shop } }),
    prisma.bundle.count({
      where: { shopDomain: session.shop, status: "ACTIVE" },
    }),
    prisma.bundle.count({
      where: { shopDomain: session.shop, status: "DRAFT" },
    }),
  ]);

  const recent = await prisma.bundle.findMany({
    where: { shopDomain: session.shop },
    select: { id: true, name: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return json({
    stats: { total, active, draft },
    recent,
  });
};

export default function AppHome() {
  const { stats, recent } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <Page>
      <TitleBar title="SAR Bundle" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h1" variant="headingLg">
                    Bundles pour votre boutique
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Créez des offres groupées (packs), gérez les étapes et la
                    tarification, puis affichez le constructeur sur vos fiches
                    produit via le bloc thème.
                  </Text>
                </BlockStack>
                <InlineStack gap="300" wrap>
                  <Button
                    variant="primary"
                    icon={PlusIcon}
                    onClick={() => navigate("/app/bundle/new")}
                  >
                    Nouveau bundle
                  </Button>
                  <Button onClick={() => navigate("/app/bundles")}>
                    Voir tous les bundles
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card padding="400">
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Aperçu
                  </Text>
                  <StatRow label="Total" value={stats.total} />
                  <StatRow label="Actifs" value={stats.active} />
                  <StatRow label="Brouillons" value={stats.draft} />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Modifiés récemment
              </Text>
              <Button variant="plain" onClick={() => navigate("/app/bundles")}>
                Tout afficher
              </Button>
            </InlineStack>
            {recent.length === 0 ? (
              <Box paddingBlock="400">
                <BlockStack gap="300" inlineAlign="center">
                  <Icon source={PackageIcon} tone="subdued" />
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    Aucun bundle pour l’instant. Créez votre premier pack pour
                    proposer une expérience d’achat guidée.
                  </Text>
                  <Button
                    variant="primary"
                    onClick={() => navigate("/app/bundle/new")}
                  >
                    Créer un bundle
                  </Button>
                </BlockStack>
              </Box>
            ) : (
              <BlockStack gap="0">
                {recent.map((b) => (
                  <Box
                    key={b.id}
                    paddingBlock="300"
                    borderBlockEndWidth="025"
                    borderColor="border"
                  >
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <BlockStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {b.name}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {statusLabel(b.status)} ·{" "}
                          {new Date(b.updatedAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Text>
                      </BlockStack>
                      <Button
                        variant="plain"
                        onClick={() => navigate(`/app/bundle/${b.id}`)}
                      >
                        Modifier
                      </Button>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <InlineStack align="space-between" blockAlign="center">
      <Text as="span" variant="bodyMd" tone="subdued">
        {label}
      </Text>
      <Text as="span" variant="headingMd">
        {value}
      </Text>
    </InlineStack>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "ACTIVE":
      return "Actif";
    case "DRAFT":
      return "Brouillon";
    case "ARCHIVED":
      return "Archivé";
    default:
      return s;
  }
}

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
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { PackageIcon, PlusIcon } from "@shopify/polaris-icons";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { fetchCommerceDashboardStats } from "../utils/shopify-dashboard-stats.server";
import { formatMoney } from "../utils/money";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  const [
    total,
    active,
    draft,
    recent,
    commerce,
  ] = await Promise.all([
    prisma.bundle.count({ where: { shopDomain: session.shop } }),
    prisma.bundle.count({
      where: { shopDomain: session.shop, status: "ACTIVE" },
    }),
    prisma.bundle.count({
      where: { shopDomain: session.shop, status: "DRAFT" },
    }),
    prisma.bundle.findMany({
      where: { shopDomain: session.shop },
      select: { id: true, name: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    fetchCommerceDashboardStats(admin),
  ]);

  return json({
    stats: { total, active, draft },
    recent,
    commerce,
  });
};

export default function AppHome() {
  const { stats, recent, commerce } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const c = commerce;

  return (
    <Page>
      <TitleBar title="SAR Bundle" />
      <BlockStack gap="500">
        {c.error ? (
          <Banner tone="critical" title="Statistiques commandes">
            <p>
              {c.error} — vérifiez que l’app a le scope{" "}
              <strong>read_orders</strong> et réinstallez l’app sur la boutique
              si besoin.
            </p>
          </Banner>
        ) : null}
        {c.truncated ? (
          <Banner tone="warning" title="Volume de commandes élevé">
            <p>
              Seules les {40 * 100} dernières commandes payantes sont prises
              en compte dans ce calcul. Pour tout l’historique, demandez le
              scope <strong>read_all_orders</strong> (validation Shopify).
            </p>
          </Banner>
        ) : null}

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
            <Card padding="400">
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Aperçu bundles
                </Text>
                <StatRow label="Total" value={stats.total} />
                <StatRow label="Actifs" value={stats.active} />
                <StatRow label="Brouillons" value={stats.draft} />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Performances de la boîte
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Basé sur les lignes de commande avec la propriété{" "}
              <code>_sar_bundle_id</code> (voir{" "}
              <Text
                as="span"
                variant="bodySm"
                tone="subdued"
                fontWeight="semibold"
              >
                Orders API
              </Text>
              , commandes payantes).
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <MetricTile
                label="Revenus des boîtes"
                value={formatMoney(c.bundleRevenue, c.currencyCode)}
              />
              <MetricTile label="Boîtes vendues" value={String(c.boxesSold)} />
              <MetricTile
                label="Valeur moyenne de la boîte"
                value={
                  c.avgBoxValue != null
                    ? formatMoney(c.avgBoxValue, c.currencyCode)
                    : "N/A"
                }
              />
              <MetricTile
                label="Vues de boîte"
                value="—"
                help="Les vues par produit ne sont pas fournies par l’API Orders. Utilisez Shopify Analytics (Rapports) ou une intégration ShopifyQL ultérieure."
              />
            </InlineGrid>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Activité boutique
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Toutes commandes avec statut financier{" "}
              <strong>payé</strong> (fenêtre API standard : 60 derniers jours
              sans <code>read_all_orders</code>).
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
              <MetricTile
                label="Revenu total"
                value={formatMoney(c.totalRevenue, c.currencyCode)}
              />
              <MetricTile
                label="Total des commandes"
                value={String(c.totalOrders)}
              />
              <MetricTile
                label="Valeur moyenne des commandes"
                value={
                  c.avgOrderValue != null
                    ? formatMoney(c.avgOrderValue, c.currencyCode)
                    : "N/A"
                }
              />
              <MetricTile
                label="Revenu mensuel des box"
                value={formatMoney(c.monthlyBundleRevenue, c.currencyCode)}
                help="Somme des lignes bundle sur le mois civil en cours."
              />
            </InlineGrid>
          </BlockStack>
        </Card>

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
                  <Text
                    as="p"
                    variant="bodyMd"
                    tone="subdued"
                    alignment="center"
                  >
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
                    <InlineStack
                      align="space-between"
                      blockAlign="center"
                      wrap
                    >
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

function MetricTile({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  return (
    <Box
      padding="400"
      background="bg-surface-secondary"
      borderRadius="200"
      borderWidth="025"
      borderColor="border"
    >
      <BlockStack gap="200">
        <Text as="span" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value}
        </Text>
        {help ? (
          <Text as="p" variant="bodySm" tone="subdued">
            {help}
          </Text>
        ) : null}
      </BlockStack>
    </Box>
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

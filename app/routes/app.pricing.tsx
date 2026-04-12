import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
  ProgressBar,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { BILLING_PLANS } from "../utils/billing-plans";
import prisma from "../db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let session;
  let billing: Awaited<ReturnType<typeof authenticate.admin>>["billing"];

  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
    billing = auth.billing;
  } catch (err) {
    console.error("[SAR/pricing] authenticate.admin failed:", err);
    throw err;
  }

  const shop = session.shop;

  // Enforce billing
  await billing.require({
    plans: [BILLING_PLANS.sar_bundle_plan.handle],
    isTest: true, // MUST BE true for Development Stores!
    onFailure: async () => billing.request({
      plan: BILLING_PLANS.sar_bundle_plan.handle,
      isTest: true, // MUST BE true for Development Stores!
    }),
  });

  let monthlyRevenue = 0;
  let charged200 = false;
  let charged1200 = false;

  try {
    const shopBilling = await prisma.shopBilling.findUnique({
      where: { shopDomain: shop },
    });
    if (shopBilling) {
      monthlyRevenue = shopBilling.monthlyBundleRevenue ?? 0;
      charged200 = shopBilling.charged200 ?? false;
      charged1200 = shopBilling.charged1200 ?? false;
    }
  } catch (err) {
    console.error("[SAR/pricing] prisma.shopBilling.findUnique failed (migration pending?):", err);
  }

  const currentCharges = (charged200 ? 14.99 : 0) + (charged1200 ? 25.0 : 0);

  return json({
    monthlyRevenue,
    currentCharges,
    charged200,
    charged1200,
    shop,
  });
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { monthlyRevenue, currentCharges, charged200, charged1200 } = useLoaderData<typeof loader>();

  const nextThreshold = monthlyRevenue < 200 ? 200 : monthlyRevenue < 1200 ? 1200 : null;
  const progressPercent = nextThreshold ? Math.min(100, (monthlyRevenue / nextThreshold) * 100) : 100;

  return (
    <Page fullWidth>
      <TitleBar title="Abonnement & Facturation" />
      <BlockStack gap="600">

        <BlockStack gap="200">
          <Text as="h1" variant="headingXl">
            Votre Abonnement SAR Bundle
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Un abonnement unique, juste et transparent. Vous payez uniquement en fonction du chiffre d'affaires mesuré généré via l'application ce mois-ci.
          </Text>
        </BlockStack>

        <Layout>
          {/* Main usage card */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Utilisation du mois en cours (UTC)</Text>
                
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="heading3xl">
                    {monthlyRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                  </Text>
                  <Badge tone={currentCharges > 0 ? "warning" : "success"}>
                    {`Facture générée : ${currentCharges.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€`}
                  </Badge>
                </InlineStack>

                <Box paddingBlockStart="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm">Progression jusqu'au {nextThreshold ? `prochain seuil (${nextThreshold}€)` : `plafond atteint`}</Text>
                      <Text as="span" variant="bodySm">
                        {progressPercent.toFixed(0)}%
                      </Text>
                    </InlineStack>
                    <ProgressBar
                      progress={progressPercent}
                      tone={progressPercent > 90 ? "highlight" : "primary"}
                    />
                  </BlockStack>
                </Box>

                <Divider />

                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">État des montants</Text>
                  
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200">
                      <div style={{ color: "var(--p-color-icon-success)" }}>
                        <Icon source={CheckIcon} tone="success" />
                      </div>
                      <Text as="span" variant="bodyMd">Installation & Utilisation de Base (jusqu'à 200€)</Text>
                    </InlineStack>
                    <Text as="span" variant="bodyMd">0.00€</Text>
                  </InlineStack>

                  <InlineStack align="space-between" blockAlign="center">
                     <InlineStack gap="200">
                      <div style={{ color: charged200 ? "var(--p-color-icon-success)" : "var(--p-color-icon-subdued)" }}>
                        <Icon source={CheckIcon} tone={charged200 ? "success" : "subdued"} />
                      </div>
                      <Text as="span" variant="bodyMd" tone={charged200 ? "base" : "subdued"}>Seuil de 200€ dépassé (+14.99€)</Text>
                    </InlineStack>
                    <Text as="span" variant="bodyMd" tone={charged200 ? "base" : "subdued"}>
                      {charged200 ? "14.99€" : "0.00€"}
                    </Text>
                  </InlineStack>

                  <InlineStack align="space-between" blockAlign="center">
                     <InlineStack gap="200">
                      <div style={{ color: charged1200 ? "var(--p-color-icon-success)" : "var(--p-color-icon-subdued)" }}>
                        <Icon source={CheckIcon} tone={charged1200 ? "success" : "subdued"} />
                      </div>
                      <Text as="span" variant="bodyMd" tone={charged1200 ? "base" : "subdued"}>Seuil de 1200€ dépassé (+25.00€)</Text>
                    </InlineStack>
                    <Text as="span" variant="bodyMd" tone={charged1200 ? "base" : "subdued"}>
                      {charged1200 ? "25.00€" : "0.00€"}
                    </Text>
                  </InlineStack>
                </BlockStack>

              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Explanation notes */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Comment fonctionne la facturation ?</Text>
                
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd">
                    💳 <strong>Facturation Automatique</strong><br />
                    L'application est 100% gratuite jusqu'à 200€ de chiffre d'affaires mesuré (commandes payées contenant vos bundles) par mois.
                  </Text>
                  <Text as="p" variant="bodyMd">
                    📈 <strong>Paliers</strong>
                    <ul>
                      <li>Au-delà de 200€, vous serez facturé de 14.99€.</li>
                      <li>Au-delà de 1200€, vous serez facturé de 25.00€ de plus.</li>
                    </ul>
                  </Text>
                  <Text as="p" variant="bodyMd">
                    🛡️ <strong>Plafond Mensuel</strong><br />
                    Le coût total ne dépassera jamais 39.99€ par mois. L'application reste active et sans restrictions même si vous générez des millions !
                  </Text>
                  <Text as="p" variant="bodyMd">
                    🗓️ <strong>Remise à Zéro</strong><br />
                    L'historique et les seuils sont réinitialisés le 1er jour de chaque mois.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

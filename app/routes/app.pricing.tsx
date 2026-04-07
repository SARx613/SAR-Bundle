import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
  Divider,
  Banner,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { BILLING_PLANS, type BillingPlanHandle } from "../utils/billing-plans";
import prisma from "../db.server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function formatRevLimit(limit: number) {
  if (limit === Infinity) return "Illimité";
  return `$${limit.toLocaleString("fr-FR")}`;
}

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
    throw err; // Let Shopify handle auth errors (redirect to login)
  }

  const shop = session.shop;
  console.log(`[SAR/pricing] Loading pricing page for shop: ${shop}`);

  // ── Read ShopBilling record safely (table may not exist yet) ──────────────
  let activePlan: BillingPlanHandle = "free_tier";
  let monthlyRevenue = 0;

  try {
    const shopBilling = await prisma.shopBilling.findUnique({
      where: { shopDomain: shop },
    });
    if (shopBilling) {
      activePlan = (shopBilling.activePlan as BillingPlanHandle) ?? "free_tier";
      monthlyRevenue = shopBilling.monthlyBundleRevenue ?? 0;
      console.log(`[SAR/pricing] ShopBilling found: plan=${activePlan}, revenue=${monthlyRevenue}`);
    } else {
      console.log(`[SAR/pricing] No ShopBilling record yet — defaulting to free_tier`);
    }
  } catch (err) {
    // Table may not exist yet if migration hasn't run
    console.error("[SAR/pricing] prisma.shopBilling.findUnique failed (migration pending?):", err);
  }

  // ── Check Shopify subscription safely ─────────────────────────────────────
  let activeShopifySubscription: string | null = null;

  try {
    const billingResult = await billing.check({
      plans: ["starter_tier", "pro_tier"],
      isTest: process.env.NODE_ENV !== "production",
    });
    console.log(`[SAR/pricing] billing.check result:`, JSON.stringify(billingResult));
    if (billingResult.hasActivePayment && billingResult.appSubscriptions?.length > 0) {
      activeShopifySubscription = billingResult.appSubscriptions[0].name ?? null;
    }
  } catch (err) {
    // No active subscription or billing not configured — not a critical error
    console.error("[SAR/pricing] billing.check failed (likely no subscription):", err);
  }

  console.log(`[SAR/pricing] Returning: activePlan=${activePlan}, activeShopifySub=${activeShopifySubscription}`);

  return json({
    activePlan,
    monthlyRevenue,
    activeShopifySubscription,
    shop,
  });
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "subscribe_starter" || intent === "subscribe_pro") {
    const planHandle = intent === "subscribe_starter" ? "starter_tier" : "pro_tier";
    await billing.request({
      plan: planHandle,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/pricing?success=1`,
    });
    // billing.request() throws a redirect — this line won't be reached
  }

  if (intent === "cancel") {
    // Downgrade to free: update our DB, Shopify cancels on their side
    await prisma.shopBilling.upsert({
      where: { shopDomain: shop },
      create: { shopDomain: shop, activePlan: "free_tier" },
      update: { activePlan: "free_tier", updatedAt: new Date() },
    });

    // Cancel active Shopify subscription
    try {
      const { appSubscriptions } = await billing.check({
        plans: ["starter_tier", "pro_tier"],
        isTest: process.env.NODE_ENV !== "production",
      });
      if (appSubscriptions.length > 0) {
        await billing.cancel({
          subscriptionId: appSubscriptions[0].id,
          isTest: process.env.NODE_ENV !== "production",
          prorate: true,
        });
      }
    } catch {
      // Already cancelled or no subscription
    }

    return redirect("/app/pricing?cancelled=1");
  }

  return json({ ok: true });
};

// ─── Plan card features ───────────────────────────────────────────────────────

const PLAN_FEATURES: Record<BillingPlanHandle, string[]> = {
  free_tier: [
    "Jusqu'à $200 de revenus générés/mois",
    "Bundles illimités créés",
    "Éditeur visuel complet",
    "App Block Storefront",
  ],
  starter_tier: [
    "Jusqu'à $1 500 de revenus générés/mois",
    "Tout ce qui est inclus dans Free",
    "Support prioritaire par email",
    "Analytics de performance",
  ],
  pro_tier: [
    "Revenus illimités",
    "Tout ce qui est inclus dans Starter",
    "Support dédié",
    "Accès anticipé aux nouvelles fonctionnalités",
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { activePlan, monthlyRevenue, activeShopifySubscription } =
    useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const url = new URL(
    typeof window !== "undefined" ? window.location.href : "http://localhost",
  );
  const justSucceeded = url.searchParams.get("success") === "1";
  const justCancelled = url.searchParams.get("cancelled") === "1";

  function handleSubscribe(intent: string) {
    submit({ intent }, { method: "POST" });
  }

  const planConfig = [
    {
      handle: "free_tier" as BillingPlanHandle,
      badge: null,
    },
    {
      handle: "starter_tier" as BillingPlanHandle,
      badge: "Populaire",
    },
    {
      handle: "pro_tier" as BillingPlanHandle,
      badge: null,
    },
  ];

  return (
    <Page>
      <TitleBar title="Abonnement & Tarification" />
      <BlockStack gap="600">
        {justSucceeded && (
          <Banner tone="success" title="Abonnement activé !">
            <p>Votre abonnement est maintenant actif. Merci de faire confiance à SAR Bundle !</p>
          </Banner>
        )}
        {justCancelled && (
          <Banner tone="info" title="Abonnement annulé">
            <p>
              Vous êtes repassé au plan <strong>Free</strong>. Votre accès reste actif jusqu'à la
              fin de la période en cours.
            </p>
          </Banner>
        )}

        <BlockStack gap="200">
          <Text as="h1" variant="headingXl">
            Choisissez votre plan
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            Payez uniquement quand vos bundles génèrent des revenus. Votre plan est déterminé par
            le chiffre d'affaires mensuel généré via l'application.
          </Text>
        </BlockStack>

        {/* Current month revenue indicator */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Revenus du mois en cours
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Cumulé depuis le 1er du mois (UTC) — commandes contenant un bundle SAR
              </Text>
            </BlockStack>
            <BlockStack inlineAlign="end" gap="100">
              <Text as="p" variant="headingXl">
                ${monthlyRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
              </Text>
              <Badge tone={activePlan === "free_tier" ? "new" : activePlan === "starter_tier" ? "info" : "success"}>
                {`Plan actuel : ${BILLING_PLANS[activePlan].name}`}
              </Badge>
            </BlockStack>
          </InlineStack>
        </Card>

        {/* Pricing cards */}
        <Layout>
          {planConfig.map(({ handle, badge }) => {
            const plan = BILLING_PLANS[handle];
            const features = PLAN_FEATURES[handle];
            const isCurrent = activePlan === handle;
            const isUpgrade =
              handle === "pro_tier" ||
              (handle === "starter_tier" && activePlan === "free_tier");
            const isDowngrade = !isCurrent && !isUpgrade;

            return (
              <Layout.Section key={handle} variant="oneThird">
                <div
                  style={{
                    height: "100%",
                    border: isCurrent
                      ? "2px solid var(--p-color-border-interactive)"
                      : "1px solid var(--p-color-border)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    background: isCurrent
                      ? "var(--p-color-bg-surface-selected)"
                      : "var(--p-color-bg-surface)",
                  }}
                >
                  <Box padding="500">
                    <BlockStack gap="400">
                      {/* Header */}
                      <InlineStack align="space-between" blockAlign="start">
                        <BlockStack gap="100">
                          <Text as="h2" variant="headingLg">
                            {plan.name}
                          </Text>
                          {badge && <Badge tone="attention">{badge}</Badge>}
                        </BlockStack>
                        {isCurrent && <Badge tone="success">Plan actuel ✓</Badge>}
                      </InlineStack>

                      {/* Price */}
                      <BlockStack gap="050">
                        <InlineStack gap="100" blockAlign="end">
                          <Text as="p" variant="heading2xl">
                            {plan.amount === 0 ? "Gratuit" : `$${plan.amount}`}
                          </Text>
                          {plan.amount > 0 && (
                            <Text as="p" variant="bodyMd" tone="subdued">
                              / mois
                            </Text>
                          )}
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Limite : {formatRevLimit(plan.revenueLimit)} de CA/mois
                        </Text>
                      </BlockStack>

                      <Divider />

                      {/* Features */}
                      <BlockStack gap="200">
                        {features.map((f) => (
                          <InlineStack key={f} gap="200" blockAlign="start">
                            <div style={{ color: "var(--p-color-icon-success)", flexShrink: 0 }}>
                              <Icon source={CheckIcon} tone="success" />
                            </div>
                            <Text as="span" variant="bodyMd">
                              {f}
                            </Text>
                          </InlineStack>
                        ))}
                      </BlockStack>

                      {/* CTA */}
                      <Box paddingBlockStart="200">
                        {isCurrent ? (
                          <>
                            <Button disabled fullWidth>
                              Plan actuel
                            </Button>
                            {handle !== "free_tier" && (
                              <Box paddingBlockStart="200">
                                <Button
                                  variant="plain"
                                  tone="critical"
                                  fullWidth
                                  loading={isLoading}
                                  onClick={() => handleSubscribe("cancel")}
                                >
                                  Annuler l'abonnement
                                </Button>
                              </Box>
                            )}
                          </>
                        ) : handle === "free_tier" ? (
                          <Button
                            variant="plain"
                            tone="critical"
                            fullWidth
                            loading={isLoading}
                            onClick={() => handleSubscribe("cancel")}
                          >
                            Rétrograder vers Free
                          </Button>
                        ) : (
                          <Button
                            variant={isUpgrade ? "primary" : "secondary"}
                            fullWidth
                            loading={isLoading}
                            onClick={() =>
                              handleSubscribe(
                                handle === "starter_tier"
                                  ? "subscribe_starter"
                                  : "subscribe_pro",
                              )
                            }
                          >
                            {isDowngrade ? "Rétrograder" : "S'abonner"} — {plan.name}
                          </Button>
                        )}
                      </Box>
                    </BlockStack>
                  </Box>
                </div>
              </Layout.Section>
            );
          })}
        </Layout>

        {/* Info note */}
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Comment ça fonctionne ?
            </Text>
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                📊 Chaque commande Shopify contenant un bundle SAR est détectée automatiquement
                via le webhook <code>orders/paid</code>.
              </Text>
              <Text as="p" variant="bodyMd">
                🗓️ Le compteur de revenus est remis à zéro le <strong>1er de chaque mois (UTC)</strong>.
              </Text>
              <Text as="p" variant="bodyMd">
                ⚠️ Si vous dépassez la limite de votre plan, une notification apparaîtra dans
                votre tableau de bord. Aucune fonctionnalité n'est bloquée, mais nous vous
                encourageons à passer au plan supérieur pour continuer sans interruption.
              </Text>
            </BlockStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

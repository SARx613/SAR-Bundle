import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Select,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Checkbox,
  DropZone,
  Thumbnail,
  Banner,
  Divider,
  Box,
  Tabs,
  RadioButton,
  Tooltip,
  Icon,
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";
import { BundleStorefrontBlocksEditor } from "./bundle-editor/BundleStorefrontBlocksEditor";
import {
  PRODUCT_LAYOUT_PRESETS,
  slugifyProductHandle,
  type ProductStyleOverrides,
} from "../utils/storefront-design";
import {
  emptyPricingTier,
  emptyStep,
  toApiPayload,
  toFormState,
  type BundleFormState,
  type SerializedBundle,
  type UiLineItemProperty,
  type UiPricingTier,
  type UiStep,
  type UiStepProduct,
  type UiStepRule,
} from "../utils/bundle-form.client";

type UploadJson = {
  ok?: boolean;
  error?: string;
  imageUrl?: string | null;
  imageGid?: string | null;
};

type SaveActionJson =
  | { ok: true; bundle: { id: string }; warning?: string }
  | { error: string; details?: string };

const STATUS_OPTIONS = [
  { label: "Brouillon", value: "DRAFT" },
  { label: "Actif", value: "ACTIVE" },
  { label: "Archivé", value: "ARCHIVED" },
];

const STANDARD_DISCOUNT_OPTIONS = [
  { label: "Pourcentage sur le total", value: "PERCENT" },
  { label: "Montant fixe déduit", value: "FIXED_AMOUNT" },
];

const DISCOUNT_TYPE_OPTIONS = [
  { label: "Pourcentage", value: "PERCENT" },
  { label: "Montant fixe", value: "FIXED_AMOUNT" },
  { label: "Prix fixe", value: "FIXED_PRICE" },
];

function PricingModeHelp({
  content,
}: {
  content: string;
}) {
  return (
    <Tooltip content={content} width="wide">
      <span style={{ display: "inline-flex", cursor: "help" }}>
        <Icon source={InfoIcon} tone="subdued" />
      </span>
    </Tooltip>
  );
}

const THRESHOLD_BASIS_OPTIONS = [
  { label: "Nombre d’articles", value: "ITEM_COUNT" },
  { label: "Valeur panier", value: "CART_VALUE" },
];

const METRIC_OPTIONS = [
  { label: "Prix du bundle", value: "BUNDLE_PRICE" },
  { label: "Nombre total d’articles", value: "TOTAL_ITEM_COUNT" },
  { label: "Quantité d’un variant", value: "VARIANT_QUANTITY" },
  { label: "Nombre de variants distincts", value: "DISTINCT_VARIANT_COUNT" },
];

const OPERATOR_OPTIONS = [
  { label: "<", value: "LT" },
  { label: "≤", value: "LTE" },
  { label: "=", value: "EQ" },
  { label: "≥", value: "GTE" },
  { label: ">", value: "GT" },
];

const PROP_TYPE_OPTIONS = [
  { label: "Case à cocher", value: "CHECKBOX" },
  { label: "Texte", value: "TEXT" },
];

type PickerVariant = {
  id: string;
  displayName?: string;
  image?: { url?: string | null } | null;
  product?: { handle?: string | null };
};

function variantsFromPickerSafe(payload: unknown): PickerVariant[] {
  if (!payload) return [];
  const p = payload as PickerVariant[] & { selection?: PickerVariant[] };
  if (Array.isArray(p.selection)) return p.selection;
  if (Array.isArray(p)) return [...p];
  return [];
}

export function BundleEditorForm({
  isNew,
  bundle: bundleRaw,
  shopDomain,
}: {
  isNew: boolean;
  bundle: SerializedBundle;
  shopDomain: string;
}) {
  const shopifyBridge = useAppBridge();
  const navigate = useNavigate();

  const bundle = bundleRaw;

  const [form, setForm] = useState<BundleFormState>(() => toFormState(bundle));
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    setForm(toFormState(bundle));
  }, [bundle.id, bundle.bundleUid, isNew]);

  const previewHandle =
    form.productHandle.trim() || slugifyProductHandle(form.name.trim() || "bundle");
  const previewProductUrl = `https://${shopDomain}/products/${previewHandle}`;

  const updateStepProduct = useCallback(
    (stepIndex: number, productIndex: number, patch: Partial<UiStepProduct>) => {
      setForm((f) => ({
        ...f,
        steps: f.steps.map((s, j) =>
          j === stepIndex
            ? {
                ...s,
                products: s.products.map((p, k) =>
                  k === productIndex ? { ...p, ...patch } : p,
                ),
              }
            : s,
        ),
      }));
    },
    [],
  );

  const saveFetcher = useFetcher<SaveActionJson>();
  const uploadFetcher = useFetcher<UploadJson>();

  const pendingUpload = useRef<
    { kind: "bundle" } | { kind: "step"; stepIndex: number } | null
  >(null);

  const saving = saveFetcher.state !== "idle";

  useEffect(() => {
    if (saveFetcher.state !== "idle" || !saveFetcher.data) return;
    const d = saveFetcher.data;
    if ("error" in d) {
      shopifyBridge.toast.show(d.error, { isError: true });
      return;
    }
    if (d.ok && d.bundle?.id && isNew) {
      shopifyBridge.toast.show("Bundle créé");
      if ("warning" in d && d.warning) {
        shopifyBridge.toast.show(d.warning, { isError: true });
      }
      navigate(`/app/bundle/${d.bundle.id}`);
      return;
    }
    if (d.ok) {
      shopifyBridge.toast.show("Enregistré");
      if ("warning" in d && d.warning) {
        shopifyBridge.toast.show(d.warning, { isError: true });
      }
    }
  }, [saveFetcher.state, saveFetcher.data, isNew, navigate, shopifyBridge]);

  useEffect(() => {
    if (uploadFetcher.state !== "idle" || !uploadFetcher.data) return;
    const d = uploadFetcher.data;
    const target = pendingUpload.current;
    pendingUpload.current = null;
    if (!d.ok) {
      shopifyBridge.toast.show(d.error ?? "Échec du téléversement", {
        isError: true,
      });
      return;
    }
    if (!target) return;
    if (target.kind === "bundle") {
      setForm((f) => ({
        ...f,
        imageUrl: d.imageUrl ?? f.imageUrl,
        imageGid: d.imageGid ?? null,
      }));
    } else {
      setForm((f) => ({
        ...f,
        steps: f.steps.map((s, i) =>
          i === target.stepIndex
            ? {
                ...s,
                imageUrl: d.imageUrl ?? s.imageUrl,
                imageGid: d.imageGid ?? null,
              }
            : s,
        ),
      }));
    }
    shopifyBridge.toast.show("Image téléversée");
  }, [uploadFetcher.state, uploadFetcher.data, shopifyBridge]);

  const handleSave = () => {
    const payload = toApiPayload(form);
    saveFetcher.submit(payload, {
      method: "POST",
      encType: "application/json",
    });
  };

  const submitFile = (
    file: File,
    target: { kind: "bundle" } | { kind: "step"; stepIndex: number },
  ) => {
    pendingUpload.current = target;
    const fd = new FormData();
    fd.append("file", file);
    uploadFetcher.submit(fd, {
      method: "POST",
      action: "/api/upload",
      encType: "multipart/form-data",
    });
  };

  const openVariantPicker = async (stepIndex: number) => {
    const selected = await shopifyBridge.resourcePicker({
      type: "variant",
      multiple: true,
      action: "add",
    });
    const variants = variantsFromPickerSafe(selected);
    if (variants.length === 0) return;
    setForm((f) => {
      const steps = [...f.steps];
      const step = steps[stepIndex];
      if (!step) return f;
      const existing = new Set(step.products.map((p) => p.variantGid));
      const additions: UiStepProduct[] = [];
      let sort = step.products.length;
      for (const v of variants) {
        if (existing.has(v.id)) continue;
        existing.add(v.id);
        additions.push({
          variantGid: v.id,
          sortOrder: sort++,
          minQuantity: null,
          maxQuantity: null,
          displayName: v.displayName ?? v.id.split("/").pop() ?? v.id,
          imageUrl: v.image?.url ?? null,
          productHandle: v.product?.handle ?? null,
          layoutPreset: "STACK_ADD_TO_QTY",
          styleOverrides: null,
        });
      }
      steps[stepIndex] = {
        ...step,
        products: [...step.products, ...additions],
      };
      return { ...f, steps };
    });
  };

  const updateTier = (i: number, patch: Partial<UiPricingTier>) => {
    setForm((f) => ({
      ...f,
      pricingTiers: f.pricingTiers.map((t, j) =>
        j === i ? { ...t, ...patch } : t,
      ),
    }));
  };

  const updateStep = (i: number, patch: Partial<UiStep>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));
  };

  const updateStepRule = (si: number, ri: number, patch: Partial<UiStepRule>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, j) =>
        j === si
          ? {
              ...s,
              rules: s.rules.map((r, k) =>
                k === ri ? { ...r, ...patch } : r,
              ),
            }
          : s,
      ),
    }));
  };

  const updateLineProp = (
    si: number,
    li: number,
    patch: Partial<UiLineItemProperty>,
  ) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, j) =>
        j === si
          ? {
              ...s,
              lineItemProperties: s.lineItemProperties.map((p, k) =>
                k === li ? { ...p, ...patch } : p,
              ),
            }
          : s,
      ),
    }));
  };

  const finalStepIndices = form.steps
    .map((s, i) => (s.isFinalStep ? i : -1))
    .filter((i) => i >= 0);
  const primaryFinalStepIndex = finalStepIndices[0] ?? null;

  const actionError =
    saveFetcher.state === "idle" &&
    saveFetcher.data &&
    "error" in saveFetcher.data
      ? saveFetcher.data.error
      : null;

  return (
    <Page
      backAction={{ content: "Bundles", url: "/app/bundles" }}
      title={isNew ? "Nouveau bundle" : "Modifier le bundle"}
      primaryAction={{
        content: "Enregistrer",
        loading: saving,
        onAction: handleSave,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionError ? (
              <Banner tone="critical" title="Erreur">
                <p>{actionError}</p>
              </Banner>
            ) : null}

            <Tabs
              tabs={[
                { id: "page", content: "Page & URL" },
                { id: "design", content: "Design boutique" },
                { id: "steps", content: "Étapes & produits" },
                { id: "pricing", content: "Tarifs & panier" },
              ]}
              selected={selectedTab}
              onSelect={setSelectedTab}
            >
              {selectedTab === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Informations générales
                </Text>
                <TextField
                  label="Nom"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  autoComplete="off"
                />
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                  multiline={4}
                  autoComplete="off"
                />
                <Select
                  label="Statut"
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as BundleFormState["status"],
                    }))
                  }
                />
                <Text as="h3" variant="headingSm">
                  Image du bundle
                </Text>
                <InlineStack gap="400" blockAlign="start">
                  {form.imageUrl ? (
                    <Thumbnail
                      source={form.imageUrl}
                      alt="Bundle"
                      size="large"
                    />
                  ) : null}
                  <DropZone
                    onDrop={(_d, accepted) => {
                      const f = accepted[0];
                      if (f) submitFile(f, { kind: "bundle" });
                    }}
                    allowMultiple={false}
                  >
                    <DropZone.FileUpload actionHint="PNG, JPG — max 5 Mo" />
                  </DropZone>
                </InlineStack>
                {form.imageGid ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    GID: {form.imageGid}
                  </Text>
                ) : null}
                <Divider />
                <Text as="h3" variant="headingSm">
                  Page produit Shopify
                </Text>
                <TextField
                  label="Segment d’URL (handle)"
                  value={form.productHandle}
                  onChange={(v) => setForm((f) => ({ ...f, productHandle: v }))}
                  autoComplete="off"
                  helpText={`Vide = généré automatiquement depuis le nom (${slugifyProductHandle(
                    form.name.trim() || "bundle",
                  )}). Aperçu : ${previewProductUrl}`}
                />
                <TextField
                  label="Titre SEO (balise title)"
                  value={form.seoTitle}
                  onChange={(v) => setForm((f) => ({ ...f, seoTitle: v }))}
                  autoComplete="off"
                />
                <TextField
                  label="Description SEO (meta)"
                  value={form.seoDescription}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, seoDescription: v }))
                  }
                  multiline={3}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
              ) : null}
              {selectedTab === 1 ? (
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Mise en page (boutique)
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Blocs au-dessus du tunnel : titres, textes, images. Les
                      produits par étape se configurent dans l’onglet suivant.
                    </Text>
                    <BundleStorefrontBlocksEditor
                      design={form.storefrontDesign}
                      onChange={(d) =>
                        setForm((f) => ({ ...f, storefrontDesign: d }))
                      }
                    />
                  </BlockStack>
                </Card>
              ) : null}
              {selectedTab === 2 ? (
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingMd">
                  Étapes (tunnel)
                </Text>
                <Button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      steps: [...f.steps, emptyStep(f.steps.length)],
                    }))
                  }
                >
                  Ajouter une étape
                </Button>

                {form.steps.length === 0 ? (
                  <Banner tone="info">
                    Aucune étape. Ajoutez une étape pour configurer le tunnel.
                  </Banner>
                ) : null}

                {form.steps.map((step, si) => (
                  <Box
                    key={si}
                    padding="400"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingMd">
                          Étape {si + 1}
                        </Text>
                        <Button
                          tone="critical"
                          variant="plain"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              steps: f.steps.filter((_, j) => j !== si),
                            }))
                          }
                        >
                          Supprimer l’étape
                        </Button>
                      </InlineStack>
                      <TextField
                        label="Nom (optionnel)"
                        value={step.name}
                        onChange={(v) => updateStep(si, { name: v })}
                        autoComplete="off"
                      />
                      <TextField
                        label="Description / consignes"
                        value={step.description}
                        onChange={(v) => updateStep(si, { description: v })}
                        multiline={3}
                        autoComplete="off"
                      />
                      <Checkbox
                        label="Étape finale (options additionnelles)"
                        checked={step.isFinalStep}
                        onChange={(v) => updateStep(si, { isFinalStep: v })}
                      />
                      <Text as="h4" variant="headingSm">
                        Image de l’étape
                      </Text>
                      <InlineStack gap="400" blockAlign="start">
                        {step.imageUrl ? (
                          <Thumbnail
                            source={step.imageUrl}
                            alt=""
                            size="medium"
                          />
                        ) : null}
                        <DropZone
                          onDrop={(_d, accepted) => {
                            const f = accepted[0];
                            if (f) submitFile(f, { kind: "step", stepIndex: si });
                          }}
                          allowMultiple={false}
                        >
                          <DropZone.FileUpload actionHint="Max 5 Mo" />
                        </DropZone>
                      </InlineStack>

                      <Divider />
                      <Text as="h4" variant="headingSm">
                        Produits éligibles
                      </Text>
                      <Button onClick={() => openVariantPicker(si)}>
                        Sélectionner des variants
                      </Button>
                      {step.products.length === 0 ? (
                        <Text as="p" tone="subdued" variant="bodySm">
                          Aucun variant sélectionné.
                        </Text>
                      ) : (
                        <BlockStack gap="300">
                          {step.products.map((p, pi) => (
                            <Box
                              key={p.variantGid}
                              padding="300"
                              background="bg-surface"
                              borderWidth="025"
                              borderColor="border"
                              borderRadius="200"
                            >
                              <BlockStack gap="300">
                                <InlineStack
                                  blockAlign="center"
                                  gap="200"
                                  wrap={false}
                                >
                                  {p.imageUrl ? (
                                    <Thumbnail
                                      source={p.imageUrl}
                                      alt=""
                                      size="small"
                                    />
                                  ) : null}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text as="p" variant="bodySm" truncate>
                                      {p.displayName}
                                    </Text>
                                    <Text
                                      as="p"
                                      variant="bodySm"
                                      tone="subdued"
                                      truncate
                                    >
                                      {p.variantGid}
                                    </Text>
                                  </div>
                                  <Button
                                    variant="plain"
                                    tone="critical"
                                    onClick={() =>
                                      setForm((f) => ({
                                        ...f,
                                        steps: f.steps.map((s, j) =>
                                          j === si
                                            ? {
                                                ...s,
                                                products: s.products.filter(
                                                  (_, k) => k !== pi,
                                                ),
                                              }
                                            : s,
                                        ),
                                      }))
                                    }
                                  >
                                    Retirer
                                  </Button>
                                </InlineStack>
                                <Select
                                  label="Disposition sur la boutique"
                                  options={[...PRODUCT_LAYOUT_PRESETS]}
                                  value={p.layoutPreset}
                                  onChange={(v) =>
                                    updateStepProduct(si, pi, {
                                      layoutPreset: v,
                                    })
                                  }
                                />
                                <TextField
                                  label="Handle produit (pour variantes)"
                                  value={p.productHandle ?? ""}
                                  onChange={(v) =>
                                    updateStepProduct(si, pi, {
                                      productHandle: v.trim() || null,
                                    })
                                  }
                                  autoComplete="off"
                                  helpText="Renseigné automatiquement si le sélecteur Shopify fournit le produit. Sinon saisissez le handle (URL du produit sans /products/)."
                                />
                                <Text as="p" variant="bodySm" fontWeight="semibold">
                                  Style de la carte produit
                                </Text>
                                <InlineStack gap="200" wrap>
                                  <div style={{ flex: "1 1 140px" }}>
                                    <TextField
                                      label="Rayon image"
                                      value={
                                        p.styleOverrides?.imageBorderRadius ??
                                        ""
                                      }
                                      onChange={(v) =>
                                        updateStepProduct(si, pi, {
                                          styleOverrides: {
                                            ...(p.styleOverrides ??
                                              ({} as ProductStyleOverrides)),
                                            imageBorderRadius: v || undefined,
                                          },
                                        })
                                      }
                                      autoComplete="off"
                                      placeholder="8px"
                                    />
                                  </div>
                                  <div style={{ flex: "1 1 140px" }}>
                                    <TextField
                                      label="Rayon bouton"
                                      value={
                                        p.styleOverrides?.buttonBorderRadius ??
                                        ""
                                      }
                                      onChange={(v) =>
                                        updateStepProduct(si, pi, {
                                          styleOverrides: {
                                            ...(p.styleOverrides ??
                                              ({} as ProductStyleOverrides)),
                                            buttonBorderRadius: v || undefined,
                                          },
                                        })
                                      }
                                      autoComplete="off"
                                    />
                                  </div>
                                </InlineStack>
                                <InlineStack gap="200" wrap>
                                  <div style={{ flex: "1 1 140px" }}>
                                    <TextField
                                      label="Fond carte"
                                      value={
                                        p.styleOverrides?.cardBackground ?? ""
                                      }
                                      onChange={(v) =>
                                        updateStepProduct(si, pi, {
                                          styleOverrides: {
                                            ...(p.styleOverrides ??
                                              ({} as ProductStyleOverrides)),
                                            cardBackground: v || undefined,
                                          },
                                        })
                                      }
                                      autoComplete="off"
                                    />
                                  </div>
                                  <div style={{ flex: "1 1 140px" }}>
                                    <TextField
                                      label="Fond bouton"
                                      value={
                                        p.styleOverrides?.buttonBackground ??
                                        ""
                                      }
                                      onChange={(v) =>
                                        updateStepProduct(si, pi, {
                                          styleOverrides: {
                                            ...(p.styleOverrides ??
                                              ({} as ProductStyleOverrides)),
                                            buttonBackground: v || undefined,
                                          },
                                        })
                                      }
                                      autoComplete="off"
                                    />
                                  </div>
                                </InlineStack>
                              </BlockStack>
                            </Box>
                          ))}
                        </BlockStack>
                      )}

                      <Divider />
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h4" variant="headingSm">
                          Règles de validation
                        </Text>
                        <Button
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              steps: f.steps.map((s, j) =>
                                j === si
                                  ? {
                                      ...s,
                                      rules: [
                                        ...s.rules,
                                        {
                                          sortOrder: s.rules.length,
                                          metric: "BUNDLE_PRICE",
                                          operator: "GTE",
                                          value: "0",
                                          targetVariantGid: "",
                                        },
                                      ],
                                    }
                                  : s,
                              ),
                            }))
                          }
                        >
                          Ajouter une règle
                        </Button>
                      </InlineStack>
                      {step.rules.map((rule, ri) => (
                        <Box
                          key={ri}
                          paddingBlockStart="200"
                          paddingBlockEnd="200"
                        >
                          <BlockStack gap="300">
                            <Select
                              label="Métrique"
                              options={METRIC_OPTIONS}
                              value={rule.metric}
                              onChange={(v) =>
                                updateStepRule(si, ri, { metric: v })
                              }
                            />
                            <Select
                              label="Opérateur"
                              options={OPERATOR_OPTIONS}
                              value={rule.operator}
                              onChange={(v) =>
                                updateStepRule(si, ri, { operator: v })
                              }
                            />
                            <TextField
                              label="Valeur"
                              value={rule.value}
                              onChange={(v) =>
                                updateStepRule(si, ri, { value: v })
                              }
                              autoComplete="off"
                            />
                            {rule.metric === "VARIANT_QUANTITY" ? (
                              <TextField
                                label="GID du variant cible"
                                value={rule.targetVariantGid}
                                onChange={(v) =>
                                  updateStepRule(si, ri, {
                                    targetVariantGid: v,
                                  })
                                }
                                autoComplete="off"
                                helpText="gid://shopify/ProductVariant/…"
                              />
                            ) : null}
                            <Button
                              variant="plain"
                              tone="critical"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  steps: f.steps.map((s, j) =>
                                    j === si
                                      ? {
                                          ...s,
                                          rules: s.rules.filter(
                                            (_, k) => k !== ri,
                                          ),
                                        }
                                      : s,
                                  ),
                                }))
                              }
                            >
                              Supprimer la règle
                            </Button>
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </Box>
                ))}
              </BlockStack>
            </Card>
              ) : null}
              {selectedTab === 3 ? (
            <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Tarification et réductions
                </Text>
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <RadioButton
                      label="Boîte standard"
                      helpText="Somme des prix des articles ; remise globale optionnelle."
                      checked={form.bundlePricingMode === "STANDARD"}
                      id="bundle-pm-standard"
                      name="bundlePricingMode"
                      onChange={() =>
                        setForm((f) => ({ ...f, bundlePricingMode: "STANDARD" }))
                      }
                    />
                    <PricingModeHelp content="Le client compose sa boîte librement. Le prix affiché est la somme des prix des variantes choisies. Vous pouvez appliquer une remise en pourcentage ou un montant fixe déduit du total (optionnel)." />
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <RadioButton
                      label="Prix fixe de la boîte"
                      helpText="Un prix catalogue unique pour exactement N articles."
                      checked={form.bundlePricingMode === "FIXED_PRICE_BOX"}
                      id="bundle-pm-fixed"
                      name="bundlePricingMode"
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          bundlePricingMode: "FIXED_PRICE_BOX",
                        }))
                      }
                    />
                    <PricingModeHelp content="Le bundle a un prix total fixe (devise de la boutique). Le client doit sélectionner exactement le nombre d’articles indiqué ; la validation bloque l’ajout au panier si le total diffère. Alignez vos règles d’étapes avec ce nombre." />
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    <RadioButton
                      label="Remises par paliers"
                      helpText="Seuils selon le nombre d’articles ou la valeur du panier."
                      checked={form.bundlePricingMode === "TIERED"}
                      id="bundle-pm-tiered"
                      name="bundlePricingMode"
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          bundlePricingMode: "TIERED",
                          pricingTiers:
                            f.pricingTiers.length === 0
                              ? [emptyPricingTier(0)]
                              : f.pricingTiers,
                        }))
                      }
                    />
                    <PricingModeHelp content="Définissez plusieurs paliers : selon le nombre total d’articles ou la valeur cumulée des articles du bundle, une remise (pourcentage, montant ou prix fixe cible selon le type choisi) s’applique au total." />
                  </InlineStack>
                </BlockStack>

                <Banner tone="info">
                  <p>
                    <strong>Bientôt :</strong> tailles de boîte prédéfinies
                    (ex. formats 4 / 6 / 8 articles à des prix différents) via
                    plusieurs variantes Shopify — prévu en phase 2.
                  </p>
                </Banner>

                {form.bundlePricingMode === "STANDARD" ? (
                  <BlockStack gap="300">
                    <Select
                      label="Remise sur le total (optionnel)"
                      options={STANDARD_DISCOUNT_OPTIONS}
                      value={form.standardDiscountType}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          standardDiscountType:
                            v as BundleFormState["standardDiscountType"],
                        }))
                      }
                    />
                    <TextField
                      label="Valeur de la remise"
                      value={form.flatDiscountValue}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, flatDiscountValue: v }))
                      }
                      autoComplete="off"
                      helpText={
                        form.standardDiscountType === "PERCENT"
                          ? "Ex. 10 pour 10 % sur la somme des articles. Laisser vide = pas de remise."
                          : "Montant en devise déduit du total. Laisser vide = pas de remise."
                      }
                    />
                  </BlockStack>
                ) : null}

                {form.bundlePricingMode === "FIXED_PRICE_BOX" ? (
                  <BlockStack gap="300">
                    <TextField
                      label="Prix fixe du bundle"
                      value={form.flatDiscountValue}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, flatDiscountValue: v }))
                      }
                      autoComplete="off"
                      helpText="Montant facturé pour la ligne bundle (devise de la boutique)."
                    />
                    <TextField
                      label="Nombre exact d’articles"
                      type="number"
                      value={form.fixedBoxItemCount}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, fixedBoxItemCount: v }))
                      }
                      autoComplete="off"
                      helpText="Le client doit avoir exactement ce nombre d’articles pour valider. Vérifiez la cohérence avec vos règles sur l’étape finale."
                    />
                  </BlockStack>
                ) : null}

                {form.bundlePricingMode === "TIERED" ? (
                  <BlockStack gap="300">
                    <Select
                      label="Type de valeur des paliers"
                      options={DISCOUNT_TYPE_OPTIONS}
                      value={form.discountValueType}
                      onChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          discountValueType:
                            v as BundleFormState["discountValueType"],
                        }))
                      }
                    />
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Paliers
                      </Text>
                      <Button
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            pricingTiers: [
                              ...f.pricingTiers,
                              emptyPricingTier(f.pricingTiers.length),
                            ],
                          }))
                        }
                      >
                        Ajouter un palier
                      </Button>
                    </InlineStack>
                    {form.pricingTiers.map((tier, i) => (
                      <Box
                        key={i}
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <BlockStack gap="300">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            Palier {i + 1}
                          </Text>
                          <Select
                            label="Seuil basé sur"
                            options={THRESHOLD_BASIS_OPTIONS}
                            value={tier.thresholdBasis}
                            onChange={(v) =>
                              updateTier(i, {
                                thresholdBasis:
                                  v as UiPricingTier["thresholdBasis"],
                              })
                            }
                          />
                          <InlineStack gap="300" wrap>
                            <div style={{ flex: "1 1 120px" }}>
                              <TextField
                                label="Min"
                                value={tier.thresholdMin}
                                onChange={(v) =>
                                  updateTier(i, { thresholdMin: v })
                                }
                                autoComplete="off"
                              />
                            </div>
                            <div style={{ flex: "1 1 120px" }}>
                              <TextField
                                label="Max (vide = illimité)"
                                value={tier.thresholdMax}
                                onChange={(v) =>
                                  updateTier(i, { thresholdMax: v })
                                }
                                autoComplete="off"
                              />
                            </div>
                            <div style={{ flex: "1 1 120px" }}>
                              <TextField
                                label="Valeur du palier"
                                value={tier.tierValue}
                                onChange={(v) =>
                                  updateTier(i, { tierValue: v })
                                }
                                autoComplete="off"
                              />
                            </div>
                          </InlineStack>
                          <Button
                            tone="critical"
                            variant="plain"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                pricingTiers: f.pricingTiers.filter(
                                  (_, j) => j !== i,
                                ),
                              }))
                            }
                          >
                            Supprimer ce palier
                          </Button>
                        </BlockStack>
                      </Box>
                    ))}
                  </BlockStack>
                ) : null}

                <Divider />
                <Checkbox
                  label="Afficher le prix barré (compare-at)"
                  checked={form.showCompareAtPrice}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, showCompareAtPrice: v }))
                  }
                />
                <Checkbox
                  label="Afficher le prix fixe au chargement"
                  checked={form.showFixedPriceOnLoad}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, showFixedPriceOnLoad: v }))
                  }
                />
                <Checkbox
                  label="Autoriser un total bundle à 0"
                  checked={form.allowZeroTotal}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, allowZeroTotal: v }))
                  }
                />
                <Text as="h3" variant="headingSm">
                  Restrictions globales
                </Text>
                <InlineStack gap="300" wrap>
                  <div style={{ flex: "1 1 140px" }}>
                    <TextField
                      label="Min articles (total)"
                      value={form.minTotalItemCount}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, minTotalItemCount: v }))
                      }
                      autoComplete="off"
                      type="number"
                    />
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <TextField
                      label="Max articles (total)"
                      value={form.maxTotalItemCount}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, maxTotalItemCount: v }))
                      }
                      autoComplete="off"
                      type="number"
                    />
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <TextField
                      label="Min valeur panier"
                      value={form.minBundleCartValue}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, minBundleCartValue: v }))
                      }
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: "1 1 140px" }}>
                    <TextField
                      label="Max valeur panier"
                      value={form.maxBundleCartValue}
                      onChange={(v) =>
                        setForm((f) => ({ ...f, maxBundleCartValue: v }))
                      }
                      autoComplete="off"
                    />
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Options finales (line item properties)
                </Text>
                {primaryFinalStepIndex === null ? (
                  <Banner tone="warning">
                    Cochez « Étape finale » sur au moins une étape pour configurer
                    les cases à cocher et champs texte envoyés au panier.
                  </Banner>
                ) : (
                  <BlockStack gap="400">
                  <Text as="p" variant="bodyMd">
                    Propriétés pour l’étape finale #{primaryFinalStepIndex + 1}{" "}
                    ({form.steps[primaryFinalStepIndex]?.name || "sans nom"}).
                  </Text>
                  <Button
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        steps: f.steps.map((s, j) =>
                          j === primaryFinalStepIndex
                            ? {
                                ...s,
                                lineItemProperties: [
                                  ...s.lineItemProperties,
                                  {
                                    sortOrder: s.lineItemProperties.length,
                                    fieldType: "TEXT",
                                    label: "",
                                    propertyKey: "",
                                    required: false,
                                    defaultChecked: false,
                                    placeholder: "",
                                  },
                                ],
                              }
                            : s,
                        ),
                      }))
                    }
                  >
                    Ajouter une propriété
                  </Button>
                  {form.steps[primaryFinalStepIndex]?.lineItemProperties.map(
                    (lp, li) => (
                      <Box
                        key={li}
                        padding="300"
                        background="bg-surface"
                        borderWidth="025"
                        borderColor="border"
                        borderRadius="200"
                      >
                        <BlockStack gap="300">
                          <Select
                            label="Type"
                            options={PROP_TYPE_OPTIONS}
                            value={lp.fieldType}
                            onChange={(v) =>
                              updateLineProp(primaryFinalStepIndex, li, {
                                fieldType: v as UiLineItemProperty["fieldType"],
                              })
                            }
                          />
                          <TextField
                            label="Libellé"
                            value={lp.label}
                            onChange={(v) =>
                              updateLineProp(primaryFinalStepIndex, li, {
                                label: v,
                              })
                            }
                            autoComplete="off"
                          />
                          <TextField
                            label="Clé (property key)"
                            value={lp.propertyKey}
                            onChange={(v) =>
                              updateLineProp(primaryFinalStepIndex, li, {
                                propertyKey: v,
                              })
                            }
                            autoComplete="off"
                            helpText="Ex. _gift_message (éviter les espaces)"
                          />
                          <TextField
                            label="Placeholder (texte)"
                            value={lp.placeholder}
                            onChange={(v) =>
                              updateLineProp(primaryFinalStepIndex, li, {
                                placeholder: v,
                              })
                            }
                            autoComplete="off"
                          />
                          <Checkbox
                            label="Obligatoire"
                            checked={lp.required}
                            onChange={(v) =>
                              updateLineProp(primaryFinalStepIndex, li, {
                                required: v,
                              })
                            }
                          />
                          {lp.fieldType === "CHECKBOX" ? (
                            <Checkbox
                              label="Coché par défaut"
                              checked={lp.defaultChecked}
                              onChange={(v) =>
                                updateLineProp(primaryFinalStepIndex, li, {
                                  defaultChecked: v,
                                })
                              }
                            />
                          ) : null}
                          <Button
                            tone="critical"
                            variant="plain"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                steps: f.steps.map((s, j) =>
                                  j === primaryFinalStepIndex
                                    ? {
                                        ...s,
                                        lineItemProperties:
                                          s.lineItemProperties.filter(
                                            (_, k) => k !== li,
                                          ),
                                      }
                                    : s,
                                ),
                              }))
                            }
                          >
                            Supprimer
                          </Button>
                        </BlockStack>
                      </Box>
                    ),
                  )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
            </BlockStack>
              ) : null}
            </Tabs>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

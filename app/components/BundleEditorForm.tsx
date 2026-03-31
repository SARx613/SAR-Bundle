import { useEffect, useRef, useState } from "react";
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
  Badge,
  Modal,
  Spinner,
} from "@shopify/polaris";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DeleteIcon,
  InfoIcon,
} from "@shopify/polaris-icons";
import { BundleVisualEditor } from "./bundle-editor/BundleVisualEditor";
import {
  PRODUCT_LAYOUT_PRESETS,
  slugifyProductHandle,
  type ProductStyleOverrides,
} from "../utils/storefront-design";
import {
  emptyPricingTier,
  emptyStep,
  newGalleryItemKey,
  toApiPayload,
  toFormState,
  type BundleFormState,
  type SerializedBundle,
  type UiLineItemProperty,
  type UiPricingTier,
} from "../utils/bundle-form.client";

type UploadJson = {
  ok?: boolean;
  error?: string;
  imageUrl?: string | null;
  imageGid?: string | null;
};

type ShopifyFilesJson =
  | { ok: true; files: { id: string; url: string; alt: string | null }[] }
  | { ok: false; error: string };

type SaveActionJson =
  | { ok: true; bundle: { id: string }; warning?: string }
  | { error: string; details?: string };

const STATUS_OPTIONS = [
  { label: "Brouillon (non vendable)", value: "DRAFT" },
  { label: "Actif (catalogue / recherche)", value: "ACTIVE" },
  {
    label: "Non répertorié (lien direct uniquement)",
    value: "UNLISTED",
  },
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
  const [galleryUrlDraft, setGalleryUrlDraft] = useState("");
  const [shopifyFilesModalOpen, setShopifyFilesModalOpen] = useState(false);
  const bundleGalleryRef = useRef(form.bundleGallery);
  bundleGalleryRef.current = form.bundleGallery;

  useEffect(() => {
    setForm(toFormState(bundle));
  }, [bundle.id, bundle.bundleUid, isNew]);

  const previewHandle =
    form.productHandle.trim() || slugifyProductHandle(form.name.trim() || "bundle");
  const previewProductUrl = `https://${shopDomain}/products/${previewHandle}`;

  const saveFetcher = useFetcher<SaveActionJson>();
  const uploadBundleFetcher = useFetcher<UploadJson>();
  const shopifyFilesFetcher = useFetcher<ShopifyFilesJson>();

  const bundleFileQueue = useRef<File[]>([]); 

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
    if (uploadBundleFetcher.state !== "idle" || !uploadBundleFetcher.data) {
      return;
    }
    const d = uploadBundleFetcher.data;
    if (!d.ok) {
      shopifyBridge.toast.show(d.error ?? "Échec du téléversement", {
        isError: true,
      });
      bundleFileQueue.current = [];
      return;
    }
    const url = d.imageUrl?.trim();
    if (!url) {
      shopifyBridge.toast.show("Aucune URL d’image retournée", {
        isError: true,
      });
    } else {
      setForm((f) => ({
        ...f,
        bundleGallery: [
          ...f.bundleGallery,
          {
            key: newGalleryItemKey(),
            url,
            mediaGid: d.imageGid ?? null,
          },
        ],
      }));
      shopifyBridge.toast.show("Image ajoutée à la galerie");
    }
    const next = bundleFileQueue.current.shift();
    if (next) {
      const fd = new FormData();
      fd.append("file", next);
      uploadBundleFetcher.submit(fd, {
        method: "POST",
        action: "/api/upload",
        encType: "multipart/form-data",
      });
    }
  }, [uploadBundleFetcher.state, uploadBundleFetcher.data, shopifyBridge]);

  const handleSave = () => {
    const payload = toApiPayload(form);
    saveFetcher.submit(JSON.stringify(payload), {
      method: "POST",
      encType: "application/json",
    });
  };

  const enqueueBundleFiles = (files: File[]) => {
    if (!files.length) return;
    bundleFileQueue.current.push(...files);
    if (uploadBundleFetcher.state !== "idle") return;
    const next = bundleFileQueue.current.shift();
    if (!next) return;
    const fd = new FormData();
    fd.append("file", next);
    uploadBundleFetcher.submit(fd, {
      method: "POST",
      action: "/api/upload",
      encType: "multipart/form-data",
    });
  };

  const submitGalleryByUrl = () => {
    const u = galleryUrlDraft.trim();
    if (!/^https?:\/\//i.test(u)) {
      shopifyBridge.toast.show("Indiquez une URL commençant par http(s)://", {
        isError: true,
      });
      return;
    }
    if (uploadBundleFetcher.state !== "idle") {
      shopifyBridge.toast.show("Un autre téléversement est en cours", {
        isError: true,
      });
      return;
    }
    if (bundleFileQueue.current.length > 0) {
      shopifyBridge.toast.show("Attendez la fin des fichiers en file d’attente", {
        isError: true,
      });
      return;
    }
    const fd = new FormData();
    fd.append("imageUrl", u);
    uploadBundleFetcher.submit(fd, {
      method: "POST",
      action: "/api/upload",
      encType: "multipart/form-data",
    });
    setGalleryUrlDraft("");
  };

  const moveGalleryItem = (index: number, delta: number) => {
    setForm((f) => {
      const g = [...f.bundleGallery];
      const j = index + delta;
      if (j < 0 || j >= g.length) return f;
      const t = g[index];
      const u = g[j];
      if (!t || !u) return f;
      g[index] = u;
      g[j] = t;
      return { ...f, bundleGallery: g };
    });
  };

  const removeGalleryItem = (key: string) => {
    setForm((f) => ({
      ...f,
      bundleGallery: f.bundleGallery.filter((x) => x.key !== key),
    }));
  };

  const addShopifyFileToGallery = (row: {
    id: string;
    url: string;
    alt: string | null;
  }) => {
    if (uploadBundleFetcher.state !== "idle") {
      shopifyBridge.toast.show(
        "Un autre téléversement est en cours",
        { isError: true },
      );
      return;
    }
    if (bundleFileQueue.current.length > 0) {
      shopifyBridge.toast.show(
        "Attendez la fin des fichiers en file d’attente",
        { isError: true },
      );
      return;
    }
    const g = bundleGalleryRef.current;
    if (g.some((x) => x.mediaGid === row.id || x.url === row.url)) {
      shopifyBridge.toast.show("Cette image est déjà dans la galerie", {
        isError: true,
      });
      return;
    }
    setForm((f) => ({
      ...f,
      bundleGallery: [
        ...f.bundleGallery,
        {
          key: newGalleryItemKey(),
          url: row.url,
          mediaGid: row.id,
        },
      ],
    }));
    shopifyBridge.toast.show("Image ajoutée à la galerie");
  };

  const updateTier = (i: number, patch: Partial<UiPricingTier>) => {
    setForm((f) => ({
      ...f,
      pricingTiers: f.pricingTiers.map((t, j) =>
        j === i ? { ...t, ...patch } : t,
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
                { id: "visual", content: "Éditeur visuel" },
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
                  label="Statut (aligné sur le produit Shopify)"
                  options={STATUS_OPTIONS}
                  value={form.status}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as BundleFormState["status"],
                    }))
                  }
                  helpText="Enregistrer le bundle met à jour le produit catalogue ; une modification dans Shopify met à jour ce statut."
                />
                <Text as="h3" variant="headingSm">
                  Galerie du bundle
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  La première image sert de vignette dans la liste et d’image
                  principale sur le produit Shopify. Glissez plusieurs fichiers
                  pour les ajouter à la suite.
                </Text>
                {form.bundleGallery.length > 0 ? (
                  <InlineStack gap="400" wrap blockAlign="start">
                    {form.bundleGallery.map((item, index) => (
                      <BlockStack key={item.key} gap="200" inlineAlign="center">
                        <Box position="relative" padding="200">
                          <Thumbnail
                            source={item.url}
                            alt=""
                            size="large"
                          />
                          {index === 0 ? (
                            <div
                              style={{
                                marginTop: 8,
                                display: "flex",
                                justifyContent: "center",
                              }}
                            >
                              <Badge tone="info">Principale</Badge>
                            </div>
                          ) : null}
                        </Box>
                        <InlineStack gap="100" blockAlign="center">
                          <Button
                            icon={ArrowUpIcon}
                            variant="plain"
                            disabled={index === 0}
                            onClick={() => moveGalleryItem(index, -1)}
                            accessibilityLabel="Monter"
                          />
                          <Button
                            icon={ArrowDownIcon}
                            variant="plain"
                            disabled={index === form.bundleGallery.length - 1}
                            onClick={() => moveGalleryItem(index, 1)}
                            accessibilityLabel="Descendre"
                          />
                          <Button
                            icon={DeleteIcon}
                            variant="plain"
                            tone="critical"
                            onClick={() => removeGalleryItem(item.key)}
                            accessibilityLabel="Retirer"
                          />
                        </InlineStack>
                      </BlockStack>
                    ))}
                  </InlineStack>
                ) : null}
                <DropZone
                  onDrop={(_d, accepted) => {
                    enqueueBundleFiles([...accepted]);
                  }}
                  allowMultiple
                >
                  <DropZone.FileUpload actionHint="PNG, JPG, WebP… — max 20 Mo chacun (CDN Shopify)" />
                </DropZone>
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Button
                    onClick={() => {
                      setShopifyFilesModalOpen(true);
                      shopifyFilesFetcher.load("/api/shopify-files?first=36");
                    }}
                  >
                    Choisir dans Fichiers Shopify
                  </Button>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Images déjà dans Admin → Contenu → Fichiers (scope read_files).
                  </Text>
                </InlineStack>
                <InlineStack gap="300" blockAlign="end" wrap>
                  <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                    <TextField
                      label="Ajouter une image par URL (https)"
                      value={galleryUrlDraft}
                      onChange={setGalleryUrlDraft}
                      autoComplete="off"
                      connectedRight={
                        <Button onClick={submitGalleryByUrl}>
                          Ajouter
                        </Button>
                      }
                    />
                  </div>
                </InlineStack>
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
                <BundleVisualEditor
                  form={form}
                  setForm={setForm}
                />
              ) : null}
              {selectedTab === 2 ? (
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

      <Modal
        open={shopifyFilesModalOpen}
        onClose={() => setShopifyFilesModalOpen(false)}
        title="Fichiers Shopify"
        primaryAction={{
          content: "Fermer",
          onAction: () => setShopifyFilesModalOpen(false),
        }}
      >
        <Modal.Section>
          {shopifyFilesFetcher.state !== "idle" ? (
            <InlineStack align="center" blockAlign="center">
              <Spinner accessibilityLabel="Chargement des fichiers" />
            </InlineStack>
          ) : shopifyFilesFetcher.data &&
            shopifyFilesFetcher.data.ok === false ? (
            <Banner tone="critical" title="Impossible de charger les fichiers">
              <p>{shopifyFilesFetcher.data.error}</p>
            </Banner>
          ) : shopifyFilesFetcher.data?.ok &&
            shopifyFilesFetcher.data.files.length === 0 ? (
            <Text as="p" variant="bodySm" tone="subdued">
              Aucune image avec URL prête n’a été trouvée. Ajoutez des images
              dans Contenu → Fichiers ou téléversez-les ci-dessus.
            </Text>
          ) : shopifyFilesFetcher.data?.ok ? (
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" tone="subdued">
                Cliquez une vignette pour l’ajouter à la galerie du bundle.
              </Text>
              <InlineStack gap="300" wrap blockAlign="start">
                {shopifyFilesFetcher.data.files.map((fileRow) => (
                  <button
                    key={fileRow.id}
                    type="button"
                    onClick={() => addShopifyFileToGallery(fileRow)}
                    style={{
                      cursor: "pointer",
                      border: "none",
                      padding: 0,
                      background: "none",
                      borderRadius: 8,
                    }}
                  >
                    <Thumbnail
                      source={fileRow.url}
                      alt={fileRow.alt ?? ""}
                      size="large"
                    />
                  </button>
                ))}
              </InlineStack>
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>
    </Page>
  );
}

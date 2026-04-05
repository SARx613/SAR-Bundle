import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  BlockStack,
  Box,
  Button,
  Collapsible,
  Icon,
  InlineStack,
  Select,
  Tabs,
  Text,
  TextField,
  Thumbnail,
  Tooltip,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DeleteIcon,
} from "@shopify/polaris-icons";
import {
  type HeroBlock,
  type StepBarBlock,
  type StorefrontBlockV2,
  type StorefrontDesignV2,
  type TextStyleBlock,
} from "../../utils/storefront-design";
import { blockDisplayLabel } from "../../utils/storefront-design";
import type { UiStep, UiStepProduct } from "../../utils/bundle-form.client";

/* ────────────────────── Heading tags ────────────────────── */

const HEADING_TAGS = [
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
  { label: "H4", value: "h4" },
  { label: "H5", value: "h5" },
  { label: "H6", value: "h6" },
] as const;

const TEXT_PRESETS = [
  { label: "H1 — Heading 1", value: "h1" },
  { label: "H2 — Heading 2", value: "h2" },
  { label: "H3 — Heading 3", value: "h3" },
  { label: "H4 — Heading 4", value: "h4" },
  { label: "H5 — Heading 5", value: "h5" },
  { label: "H6 — Heading 6", value: "h6" },
  { label: "Paragraphe", value: "p" },
  { label: "Personnalisé", value: "custom" },
] as const;

/* ────────────────────── Collapsible Section ────────────────────── */

function CollapsibleStyleSection({
  title,
  id,
  children,
  defaultOpen = false,
}: {
  title: string;
  id: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "8px 0",
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--p-color-border-subdued)",
          cursor: "pointer",
          color: "var(--p-color-text)",
          fontWeight: 600,
          fontSize: "0.8rem",
        }}
        aria-expanded={open}
      >
        <span>{title}</span>
        <Icon source={open ? ChevronDownIcon : ChevronRightIcon} />
      </button>
      <Collapsible id={id} open={open}>
        <div style={{ paddingTop: 8, paddingBottom: 4 }}>
          {children}
        </div>
      </Collapsible>
    </div>
  );
}

/* ────────────────────── Style Fields (Chantier 7) ────────────────────── */

function StyleFields({
  style,
  onChange,
  showTextPreset,
}: {
  style: TextStyleBlock;
  onChange: (s: TextStyleBlock) => void;
  showTextPreset?: boolean;
}) {
  const preset = style.textPreset ?? "custom";

  return (
    <BlockStack gap="100">
      {/* Text preset selector for heading/text blocks */}
      {showTextPreset && (
        <CollapsibleStyleSection title="Typographie" id="sec-typo" defaultOpen>
          <BlockStack gap="200">
            <Select
              label="Style de texte"
              options={[...TEXT_PRESETS]}
              value={preset}
              onChange={(v) => {
                const next = { ...style, textPreset: v as TextStyleBlock["textPreset"] };
                // Reset custom values when switching to a preset
                if (v !== "custom") {
                  delete next.fontSize;
                  delete next.fontWeight;
                  delete next.fontFamily;
                }
                onChange(next);
              }}
            />
            {preset === "custom" && (
              <>
                <TextField
                  label="Taille police"
                  value={style.fontSize ?? ""}
                  onChange={(v) => onChange({ ...style, fontSize: v || undefined })}
                  autoComplete="off"
                  helpText="ex. 1.25rem, 18px"
                />
                <TextField
                  label="Police (CSS)"
                  value={style.fontFamily ?? ""}
                  onChange={(v) => onChange({ ...style, fontFamily: v || undefined })}
                  autoComplete="off"
                  helpText="ex. system-ui, Georgia"
                />
                <TextField
                  label="Graisse"
                  value={style.fontWeight ?? ""}
                  onChange={(v) => onChange({ ...style, fontWeight: v || undefined })}
                  autoComplete="off"
                  helpText="ex. 400, 600, bold"
                />
              </>
            )}
            <Select
              label="Alignement"
              options={[
                { label: "Gauche", value: "left" },
                { label: "Centre", value: "center" },
                { label: "Droite", value: "right" },
              ]}
              value={style.textAlign ?? "left"}
              onChange={(v) =>
                onChange({ ...style, textAlign: v as TextStyleBlock["textAlign"] })
              }
            />
          </BlockStack>
        </CollapsibleStyleSection>
      )}

      {/* Couleur */}
      <CollapsibleStyleSection title="Couleur" id="sec-color">
        <BlockStack gap="200">
          <TextField
            label="Couleur du contenu"
            value={style.color ?? ""}
            onChange={(v) => onChange({ ...style, color: v || undefined })}
            autoComplete="off"
            helpText="ex. #333, var(--p-color-text)"
            prefix={
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: style.color || "var(--p-color-text)",
                  border: "1px solid var(--p-color-border)",
                }}
              />
            }
          />
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Arrière-plan */}
      <CollapsibleStyleSection title="Arrière-plan" id="sec-bg">
        <BlockStack gap="200">
          <TextField
            label="Couleur d'arrière-plan"
            value={style.backgroundColor ?? ""}
            onChange={(v) => onChange({ ...style, backgroundColor: v || undefined })}
            autoComplete="off"
            helpText="ex. #fff, var(--p-color-bg-surface)"
            prefix={
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: style.backgroundColor || "transparent",
                  border: "1px solid var(--p-color-border)",
                }}
              />
            }
          />
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Espacement */}
      <CollapsibleStyleSection title="Espacement" id="sec-spacing">
        <BlockStack gap="300">
          <Text as="p" variant="bodySm" fontWeight="semibold">
            Marge intérieure (padding)
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <TextField
              label="Haut"
              value={style.paddingTop ?? style.padding ?? ""}
              onChange={(v) => onChange({ ...style, paddingTop: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Haut"
            />
            <TextField
              label="Droite"
              value={style.paddingRight ?? ""}
              onChange={(v) => onChange({ ...style, paddingRight: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Droite"
            />
            <TextField
              label="Bas"
              value={style.paddingBottom ?? ""}
              onChange={(v) => onChange({ ...style, paddingBottom: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Bas"
            />
            <TextField
              label="Gauche"
              value={style.paddingLeft ?? ""}
              onChange={(v) => onChange({ ...style, paddingLeft: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Gauche"
            />
          </div>

          <Text as="p" variant="bodySm" fontWeight="semibold">
            Marge extérieure (margin)
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <TextField
              label="Haut"
              value={style.marginTop ?? ""}
              onChange={(v) => onChange({ ...style, marginTop: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Haut"
            />
            <TextField
              label="Droite"
              value={style.marginRight ?? ""}
              onChange={(v) => onChange({ ...style, marginRight: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Droite"
            />
            <TextField
              label="Bas"
              value={style.marginBottom ?? ""}
              onChange={(v) => onChange({ ...style, marginBottom: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Bas"
            />
            <TextField
              label="Gauche"
              value={style.marginLeft ?? ""}
              onChange={(v) => onChange({ ...style, marginLeft: v || undefined })}
              autoComplete="off"
              labelHidden
              placeholder="Gauche"
            />
          </div>
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Bordure */}
      <CollapsibleStyleSection title="Bordure" id="sec-border">
        <BlockStack gap="200">
          <TextField
            label="Épaisseur"
            value={style.borderWidth ?? ""}
            onChange={(v) => onChange({ ...style, borderWidth: v || undefined })}
            autoComplete="off"
            helpText="ex. 1px, 2px"
          />
          <TextField
            label="Couleur"
            value={style.borderColor ?? ""}
            onChange={(v) => onChange({ ...style, borderColor: v || undefined })}
            autoComplete="off"
            helpText="ex. #ccc, var(--p-color-border)"
          />
          <TextField
            label="Rayon"
            value={style.borderRadius ?? ""}
            onChange={(v) => onChange({ ...style, borderRadius: v || undefined })}
            autoComplete="off"
            helpText="ex. 8px, var(--p-border-radius-200)"
          />
        </BlockStack>
      </CollapsibleStyleSection>
    </BlockStack>
  );
}

/* ────────────────────── Step Bar Style Fields ────────────────────── */

function StepBarStyleFields({
  block,
  onPatch,
}: {
  block: StorefrontBlockV2;
  onPatch: (patch: Partial<StorefrontBlockV2>) => void;
}) {
  if (block.type !== "step_bar") return null;
  const style = block.style || {};
  const currentPreset = block.preset || "default";
  
  const patchStyle = (s: Partial<StepBarBlock["style"]>) =>
    onPatch({ style: { ...style, ...s } } as Partial<StorefrontBlockV2>);

  return (
    <BlockStack gap="200">
      <Select
        label="Design prédéfini"
        options={[
          { label: "Classique (Numéros)", value: "default" },
          { label: "Cercle doré (Luxe)", value: "circles" },
          { label: "Lignes plates", value: "lines" },
          { label: "Minimal (Petits points)", value: "minimal" },
        ]}
        value={currentPreset}
        onChange={(v) => onPatch({ preset: v as StepBarBlock["preset"] } as Partial<StorefrontBlockV2>)}
      />

      <CollapsibleStyleSection title="Couleurs" id="sec-stepbar-colors">
        <BlockStack gap="200">
          <TextField
            label="Couleur bordure / lignes"
            value={style.borderColor ?? ""}
            onChange={(v) => patchStyle({ borderColor: v || undefined })}
            autoComplete="off"
          />
          <TextField
            label="Fond étape active"
            value={style.activeBg ?? ""}
            onChange={(v) => patchStyle({ activeBg: v || undefined })}
            autoComplete="off"
          />
          <TextField
            label="Fond étape inactive"
            value={style.inactiveBg ?? ""}
            onChange={(v) => patchStyle({ inactiveBg: v || undefined })}
            autoComplete="off"
          />
          <TextField
            label="Couleur texte (active)"
            value={style.activeTextColor ?? ""}
            onChange={(v) => patchStyle({ activeTextColor: v || undefined })}
            autoComplete="off"
          />
          <TextField
            label="Couleur texte (inactive)"
            value={style.inactiveTextColor ?? ""}
            onChange={(v) => patchStyle({ inactiveTextColor: v || undefined })}
            autoComplete="off"
          />
        </BlockStack>
      </CollapsibleStyleSection>
    </BlockStack>
  );
}

/* ────────────────────── Product Management for product_list ────────────────────── */

type VariantsMetaJson = {
  items: Array<{
    id: string;
    displayTitle: string;
    imageUrl: string | null;
    productHandle: string | null;
  }>;
};

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

function ProductListManager({
  block,
  step,
  onPatch,
  onStepProductsChange,
}: {
  block: StorefrontBlockV2;
  step: UiStep | undefined;
  onPatch: (patch: Partial<StorefrontBlockV2>) => void;
  onStepProductsChange: (products: UiStepProduct[]) => void;
}) {
  const shopifyBridge = useAppBridge();
  const variantsMetaFetcher = useFetcher<VariantsMetaJson>();

  if (block.type !== "product_list") return null;
  const source = block.source ?? "step_pick";
  const products = step?.products ?? [];

  const enrichVariants = (gids: string[]) => {
    if (gids.length === 0) return;
    const params = new URLSearchParams();
    gids.forEach((g) => params.append("ids", g));
    variantsMetaFetcher.load(`/api/shopify-variants?${params.toString()}`);
  };

  // Apply enrichment when fetcher resolves
  if (
    variantsMetaFetcher.state === "idle" &&
    variantsMetaFetcher.data &&
    step
  ) {
    const byId = new Map(variantsMetaFetcher.data.items.map((x) => [x.id, x]));
    if (byId.size > 0) {
      const enriched = products.map((p) => {
        const meta = byId.get(p.variantGid);
        if (!meta) return p;
        return {
          ...p,
          displayName: meta.displayTitle || p.displayName,
          imageUrl: meta.imageUrl ?? p.imageUrl,
          productHandle: meta.productHandle ?? p.productHandle,
        };
      });
      // Only update if something actually changed
      const changed = enriched.some((e, i) => {
        const prev = products[i];
        return (
          prev &&
          (e.displayName !== prev.displayName ||
           e.imageUrl !== prev.imageUrl ||
           e.productHandle !== prev.productHandle)
        );
      });
      if (changed) onStepProductsChange(enriched);
    }
  }

  const openVariantPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "variant",
      multiple: true,
      action: "add",
    });
    const variants = variantsFromPickerSafe(selected);
    if (variants.length === 0) return;
    const existing = new Set(products.map((p) => p.variantGid));
    const additions: UiStepProduct[] = [];
    let sort = products.length;
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
    onStepProductsChange([...products, ...additions]);
    const missing = additions
      .filter((a) => !a.imageUrl || !a.displayName?.trim() || !a.productHandle)
      .map((a) => a.variantGid);
    if (missing.length) enrichVariants(missing);
  };

  const openProductPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
    });
    const sel = (selected as unknown as { selection?: Array<Record<string, unknown>> } | null)?.selection;
    if (!Array.isArray(sel) || sel.length === 0) return;

    const existing = new Set(products.map((p) => p.variantGid));
    const additions: UiStepProduct[] = [];
    let sort = products.length;

    for (const p of sel) {
      const variants = Array.isArray(p.variants) ? (p.variants as Array<Record<string, unknown>>) : [];
      const first = variants[0];
      const firstId = first && typeof first.id === "string" ? first.id : null;
      if (!firstId) continue;
      const variantGid = firstId.startsWith("gid://")
        ? firstId
        : `gid://shopify/ProductVariant/${firstId}`;
      if (existing.has(variantGid)) continue;
      existing.add(variantGid);

      const title =
        (typeof p.title === "string" && p.title.trim()) ||
        (typeof p.handle === "string" && p.handle.trim()) ||
        variantGid;

      const imageUrl =
        (p.image && typeof (p.image as { url?: unknown }).url === "string"
          ? ((p.image as { url: string }).url as string)
          : null) || null;

      additions.push({
        variantGid,
        sortOrder: sort++,
        minQuantity: null,
        maxQuantity: null,
        displayName: title,
        imageUrl,
        productHandle: typeof p.handle === "string" ? (p.handle as string) : null,
        layoutPreset: "STACK_ADD_TO_QTY",
        styleOverrides: null,
      });
    }

    if (additions.length) {
      onStepProductsChange([...products, ...additions]);
      const missing = additions
        .filter((a) => !a.imageUrl || !a.displayName?.trim() || !a.productHandle)
        .map((a) => a.variantGid);
      if (missing.length) enrichVariants(missing);
    }
  };

  return (
    <BlockStack gap="300">
      <Select
        label="Source des produits"
        options={[
          { label: "Produits sélectionnés (étape)", value: "step_pick" },
          { label: "Collection", value: "collection" },
        ]}
        value={source}
        onChange={(v) =>
          onPatch({
            source: v as "step_pick" | "collection",
            ...(v === "collection" ? {} : { collectionHandle: undefined }),
          } as Partial<StorefrontBlockV2>)
        }
      />

      {source === "collection" ? (
        <BlockStack gap="200">
          <TextField
            label="Handle de collection"
            value={block.collectionHandle ?? ""}
            onChange={(v) =>
              onPatch({ collectionHandle: v.trim() || undefined } as Partial<StorefrontBlockV2>)
            }
            autoComplete="off"
            helpText="Ex: /collections/mon-handle → mon-handle"
          />
          <Button
            onClick={async () => {
              const selected = await shopifyBridge.resourcePicker({
                type: "collection",
                multiple: false,
                action: "select",
              });
              const sel = (selected as { selection?: Array<{ handle?: string }> } | null)
                ?.selection?.[0];
              if (sel?.handle) {
                onPatch({ collectionHandle: String(sel.handle) } as Partial<StorefrontBlockV2>);
              }
            }}
          >
            Sélectionner une collection
          </Button>
        </BlockStack>
      ) : (
        <BlockStack gap="300">
          <InlineStack gap="200" wrap>
            <Button onClick={openVariantPicker}>Ajouter des variants</Button>
            <Button onClick={openProductPicker} variant="secondary">
              Ajouter des produits
            </Button>
          </InlineStack>

          {products.length === 0 ? (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Aucun produit sélectionné. Utilisez les boutons ci-dessus pour ajouter des produits.
              </Text>
            </Box>
          ) : (
            <BlockStack gap="200">
              {products.map((p, pi) => (
                <Box
                  key={p.variantGid}
                  padding="200"
                  borderWidth="025"
                  borderColor="border"
                  borderRadius="200"
                  background="bg-surface"
                >
                  <InlineStack gap="200" blockAlign="center" wrap={false}>
                    {p.imageUrl ? (
                      <Thumbnail source={p.imageUrl} alt="" size="small" />
                    ) : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text as="p" variant="bodySm" truncate>
                        {p.displayName}
                      </Text>
                    </div>
                    <Tooltip content="Retirer">
                      <Button
                        icon={DeleteIcon}
                        variant="plain"
                        tone="critical"
                        onClick={() =>
                          onStepProductsChange(products.filter((_, k) => k !== pi))
                        }
                        accessibilityLabel="Retirer"
                      />
                    </Tooltip>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}

/* ────────────────────── Block General Fields ────────────────────── */

function BlockGeneralFields({
  block,
  step,
  onPatch,
  onStepProductsChange,
}: {
  block: StorefrontBlockV2;
  step: UiStep | undefined;
  onPatch: (patch: Partial<StorefrontBlockV2>) => void;
  onStepProductsChange: (products: UiStepProduct[]) => void;
}) {
  if (block.type === "heading") {
    return (
      <BlockStack gap="300">
        <TextField
          label="Texte"
          value={block.text}
          onChange={(v) => onPatch({ text: v })}
          autoComplete="off"
        />
        <Select
          label="Balise SEO"
          options={[...HEADING_TAGS]}
          value={block.tag}
          onChange={(v) => onPatch({ tag: v as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" })}
        />
      </BlockStack>
    );
  }
  if (block.type === "text") {
    return (
      <TextField
        label="Contenu"
        value={block.text}
        onChange={(v) => onPatch({ text: v })}
        multiline={4}
        autoComplete="off"
      />
    );
  }
  if (block.type === "image") {
    return (
      <BlockStack gap="300">
        <TextField
          label="URL image (https)"
          value={block.url ?? ""}
          onChange={(v) => onPatch({ url: v.trim() || null })}
          autoComplete="off"
        />
        <TextField
          label="Texte alternatif (alt)"
          value={block.alt}
          onChange={(v) => onPatch({ alt: v })}
          autoComplete="off"
        />
        <TextField
          label="Largeur max"
          value={block.style.maxWidth ?? ""}
          onChange={(v) =>
            onPatch({ style: { ...block.style, maxWidth: v || undefined } })
          }
          autoComplete="off"
        />
      </BlockStack>
    );
  }
  if (block.type === "spacer") {
    return (
      <TextField
        label="Hauteur (px)"
        value={String(block.height)}
        onChange={(v) => onPatch({ height: Math.max(0, parseInt(v, 10) || 0) })}
        autoComplete="off"
      />
    );
  }
  if (block.type === "hero") {
    return (
      <BlockStack gap="300">
        <TextField
          label="Titre"
          value={block.headline}
          onChange={(v) => onPatch({ headline: v })}
          autoComplete="off"
        />
        <TextField
          label="Sous-texte"
          value={block.subtext ?? ""}
          onChange={(v) => onPatch({ subtext: v || undefined })}
          multiline={2}
          autoComplete="off"
        />
        <TextField
          label="URL image"
          value={block.imageUrl ?? ""}
          onChange={(v) => onPatch({ imageUrl: v.trim() || null })}
          autoComplete="off"
        />
        <Select
          label="Mise en page"
          options={[
            { label: "Image au-dessus", value: "stack" },
            { label: "Image à gauche", value: "image_left" },
            { label: "Image à droite", value: "image_right" },
          ]}
          value={block.layout ?? "stack"}
          onChange={(v) => onPatch({ layout: v as HeroBlock["layout"] })}
        />
      </BlockStack>
    );
  }
  if (block.type === "split") {
    return (
      <BlockStack gap="300">
        <TextField
          label="Titre"
          value={block.title}
          onChange={(v) => onPatch({ title: v })}
          autoComplete="off"
        />
        <TextField
          label="Texte"
          value={block.body}
          onChange={(v) => onPatch({ body: v })}
          multiline={4}
          autoComplete="off"
        />
        <TextField
          label="URL image"
          value={block.imageUrl ?? ""}
          onChange={(v) => onPatch({ imageUrl: v.trim() || null })}
          autoComplete="off"
        />
        <Select
          label="Côté image"
          options={[
            { label: "Gauche", value: "left" },
            { label: "Droite", value: "right" },
          ]}
          value={block.imageSide}
          onChange={(v) => onPatch({ imageSide: v as "left" | "right" })}
        />
      </BlockStack>
    );
  }
  if (block.type === "product_list") {
    return (
      <ProductListManager
        block={block}
        step={step}
        onPatch={onPatch}
        onStepProductsChange={onStepProductsChange}
      />
    );
  }
  if (block.type === "step_bar") {
    return (
      <Text as="p" variant="bodySm" tone="subdued">
        La barre d'étape affiche la progression du bundle. Configurez les couleurs dans l'onglet Style.
      </Text>
    );
  }
  return null;
}

/* ────────────────────── Main Component ────────────────────── */

export function SidebarLevel3({
  blockId,
  stepName,
  stepIndex,
  step,
  design,
  onDesignChange,
  onStepPatch,
  onStepProductsChange,
  onBack,
  onGoToSettings,
  activeTab,
  onTabChange,
  onDeleteBlock,
}: {
  blockId: string;
  stepName: string;
  stepIndex: number;
  step: UiStep | undefined;
  design: StorefrontDesignV2;
  onDesignChange: (d: StorefrontDesignV2) => void;
  onStepPatch: (patch: Partial<UiStep>) => void;
  onStepProductsChange: (products: UiStepProduct[]) => void;
  onBack: () => void;
  onGoToSettings: () => void;
  activeTab: number;
  onTabChange: (t: number) => void;
  onDeleteBlock: (blockId: string) => void;
}) {
  const block = design.blocks.find((b) => b.id === blockId);

  if (!block) {
    return (
      <BlockStack gap="300">
        <Button variant="plain" onClick={onBack}>
          ← {stepName || "Mise en page"}
        </Button>
        <Text as="p" tone="subdued" variant="bodySm">
          Bloc introuvable.
        </Text>
      </BlockStack>
    );
  }

  const patchBlock = (patch: Partial<StorefrontBlockV2>) => {
    onDesignChange({
      ...design,
      version: 2,
      blocks: design.blocks.map((b) =>
        b.id === blockId ? ({ ...b, ...patch } as StorefrontBlockV2) : b,
      ),
    });
  };

  const styleBlock =
    "style" in block
      ? (block.style as TextStyleBlock)
      : { fontSize: "1rem", color: "var(--p-color-text)" };

  // Whether this block type supports text presets
  const supportsTextPreset = block.type === "heading" || block.type === "text";

  const backBtn = (
    <Tooltip content={stepName || "Mise en page"}>
      <Button
        icon={ArrowLeftIcon}
        variant="plain"
        onClick={onBack}
        accessibilityLabel={`Retour à ${stepName}`}
      />
    </Tooltip>
  );

  const generalTab = (
    <BlockStack gap="300">
      <InlineStack gap="200" blockAlign="center">
        {backBtn}
        <Text as="h3" variant="headingSm" truncate>
          {blockDisplayLabel(block)}
        </Text>
      </InlineStack>

      {/* Chantier 4: Editable block name */}
      <TextField
        label="Nom de la section"
        value={(block as { name?: string }).name ?? ""}
        onChange={(v) => patchBlock({ name: v || undefined } as Partial<StorefrontBlockV2>)}
        autoComplete="off"
        placeholder={blockDisplayLabel(block)}
        helpText="Nom affiché dans la sidebar — laisser vide pour utiliser le nom par défaut."
      />

      <BlockGeneralFields
        block={block}
        step={step}
        onPatch={patchBlock}
        onStepProductsChange={onStepProductsChange}
      />

      {block.type !== "product_list" && (
        <Button
          tone="critical"
          variant="plain"
          onClick={() => onDeleteBlock(blockId)}
        >
          Supprimer ce bloc
        </Button>
      )}
    </BlockStack>
  );

  const styleTab = (
    <BlockStack gap="300">
      <InlineStack gap="200" blockAlign="center">
        {backBtn}
        <Text as="h3" variant="headingSm" truncate>
          {blockDisplayLabel(block)}
        </Text>
      </InlineStack>
      <Text as="p" variant="bodySm" tone="subdued">
        Les variables CSS Shopify s'adaptent automatiquement au thème de la boutique.
      </Text>
      {block.type === "step_bar" ? (
        <StepBarStyleFields
          block={block}
          onPatch={(patch) => patchBlock(patch as Partial<StorefrontBlockV2>)}
        />
      ) : "style" in block ? (
        <StyleFields
          style={styleBlock}
          onChange={(s) => patchBlock({ style: s } as Partial<StorefrontBlockV2>)}
          showTextPreset={supportsTextPreset}
        />
      ) : (
        <Text as="p" variant="bodySm" tone="subdued">
          Ce type de bloc n'a pas de styles configurables ici.
        </Text>
      )}
    </BlockStack>
  );

  return (
    <Tabs
      fitted
      tabs={[
        {
          id: "general",
          content: "Générale",
          accessibilityLabel: "Générale",
        },
        {
          id: "style",
          content: "Style",
          accessibilityLabel: "Style",
        },
      ]}
      selected={activeTab}
      onSelect={onTabChange}
    >
      <Box paddingBlockStart="400">
        {activeTab === 0 ? generalTab : styleTab}
      </Box>
    </Tabs>
  );
}

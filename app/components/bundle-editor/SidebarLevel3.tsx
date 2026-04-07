import { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  BlockStack,
  Box,
  Button,
  Collapsible,
  DropZone,
  Icon,
  InlineGrid,
  InlineStack,
  RangeSlider,
  Select,
  Tabs,
  Text,
  TextField,
  Thumbnail,
  Tooltip,
  ButtonGroup,
  Checkbox,
  Divider,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DeleteIcon,
  PlusIcon,
  CashEuroIcon,
} from "@shopify/polaris-icons";
import {
  type HeroBlock,
  type StepBarBlock,
  type ProductListBlock,
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

/* ────────────────────── Color Swatch Prefix ────────────────────── */

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: color || "transparent",
        border: "1px solid var(--p-color-border)",
        flexShrink: 0,
      }}
    />
  );
}

/* ────────────────────── Color field with native picker ────────────────────── */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Parse hex to display
  const displayValue = value || "";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Text as="span" variant="bodyMd">{label}</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid var(--p-color-border)",
            cursor: "pointer",
            overflow: "hidden",
            position: "relative",
            background: displayValue || "#ffffff",
          }}
        >
          <input
            type="color"
            value={displayValue || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        </label>
        <div style={{ flex: 1 }}>
          <TextField
            label=""
            labelHidden
            value={displayValue}
            onChange={onChange}
            autoComplete="off"
            placeholder="#000000 ou rgba()"
          />
        </div>
        {displayValue && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--p-color-text-subdued)",
              fontSize: 16,
              padding: 4,
            }}
            title="Effacer"
          >✕</button>
        )}
      </div>
    </div>
  );
}

/* ────────────────────── Numeric field with suffix ────────────────────── */

function NumericField({
  label,
  value,
  onChange,
  suffix = "px",
  min,
  max,
  step = 1,
  placeholder = "0",
  labelHidden = false,
}: {
  label: string;
  value: number | undefined | null;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  labelHidden?: boolean;
}) {
  return (
    <TextField
      label={label}
      labelHidden={labelHidden}
      type="number"
      value={value != null ? String(value) : ""}
      onChange={(v) => {
        const n = parseInt(v, 10);
        onChange(isNaN(n) ? undefined : Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
      }}
      autoComplete="off"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      suffix={suffix}
    />
  );
}

/* ────────────────────── Slider + Number combo ────────────────────── */

function SliderNumericField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "px",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="span" variant="bodyMd">{label}</Text>
      </InlineStack>
      <InlineGrid columns={["twoThirds", "oneThird"]} gap="200">
        <RangeSlider
          label={label}
          labelHidden
          value={value}
          onChange={(v) => onChange(typeof v === "number" ? v : v[0])}
          min={min}
          max={max}
          step={step}
          output
        />
        <NumericField
          label={label}
          labelHidden
          value={value}
          onChange={(v) => onChange(v ?? min)}
          suffix={suffix}
          min={min}
          max={max}
          step={step}
        />
      </InlineGrid>
    </BlockStack>
  );
}

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
    <Box borderBlockEndWidth="025" borderColor="border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--p-color-text)",
        }}
        aria-expanded={open}
      >
        <Text as="span" variant="headingMd">{title}</Text>
        <Icon source={open ? ChevronDownIcon : ChevronRightIcon} />
      </button>
      <Collapsible id={id} open={open}>
        <Box padding="300">
          {children}
        </Box>
      </Collapsible>
    </Box>
  );
}

/* ────────────────────── Spacing Grid (3x3 cross) ────────────────────── */

function SpacingGrid({
  label,
  top,
  right,
  bottom,
  left,
  onChangeTop,
  onChangeRight,
  onChangeBottom,
  onChangeLeft,
}: {
  label: string;
  top: number | undefined;
  right: number | undefined;
  bottom: number | undefined;
  left: number | undefined;
  onChangeTop: (v: number | undefined) => void;
  onChangeRight: (v: number | undefined) => void;
  onChangeBottom: (v: number | undefined) => void;
  onChangeLeft: (v: number | undefined) => void;
}) {
  return (
    <BlockStack gap="100">
      <Text as="span" variant="bodyMd" fontWeight="semibold">{label}</Text>
      <Box
        background="bg"
        borderColor="border"
        borderWidth="025"
        borderRadius="200"
        padding="200"
      >
        <InlineGrid columns={["oneThird", "oneThird", "oneThird"]} gap="200">
          {/* Row 1: _, top, _ */}
          <Box />
          <NumericField label="top" labelHidden value={top} onChange={onChangeTop} placeholder="0" />
          <Box />
          {/* Row 2: left, _, right */}
          <NumericField label="left" labelHidden value={left} onChange={onChangeLeft} placeholder="0" />
          <Box />
          <NumericField label="right" labelHidden value={right} onChange={onChangeRight} placeholder="0" />
          {/* Row 3: _, bottom, _ */}
          <Box />
          <NumericField label="bottom" labelHidden value={bottom} onChange={onChangeBottom} placeholder="0" />
          <Box />
        </InlineGrid>
      </Box>
    </BlockStack>
  );
}

/* ──────── Helper: parse px string to number ──────── */
function pxToNum(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseInt(s.replace(/px$/i, ""), 10);
  return isNaN(n) ? undefined : n;
}
function numToPx(n: number | undefined): string | undefined {
  return n != null ? `${n}px` : undefined;
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
    <BlockStack gap="0">
      {/* Typographie */}
      {showTextPreset && (
        <CollapsibleStyleSection title="Typographie" id="sec-typo" defaultOpen>
          <BlockStack gap="300">
            <Select
              label="Style de texte"
              options={[...TEXT_PRESETS]}
              value={preset}
              onChange={(v) => {
                const next = { ...style, textPreset: v as TextStyleBlock["textPreset"] };
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
                <SliderNumericField
                  label="Taille police"
                  value={pxToNum(style.fontSize) ?? 16}
                  onChange={(v) => onChange({ ...style, fontSize: `${v}px` })}
                  min={8}
                  max={72}
                />
                <TextField
                  label="Police (CSS)"
                  value={style.fontFamily ?? ""}
                  onChange={(v) => onChange({ ...style, fontFamily: v || undefined })}
                  autoComplete="off"
                  helpText="ex. system-ui, Georgia"
                />
                <Select
                  label="Graisse"
                  options={[
                    { label: "Normal (400)", value: "400" },
                    { label: "Medium (500)", value: "500" },
                    { label: "Semi-bold (600)", value: "600" },
                    { label: "Bold (700)", value: "700" },
                    { label: "Extra-bold (800)", value: "800" },
                  ]}
                  value={style.fontWeight ?? "400"}
                  onChange={(v) => onChange({ ...style, fontWeight: v })}
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

      {/* Espacement */}
      <CollapsibleStyleSection title="Espacement" id="sec-spacing">
        <BlockStack gap="400">
          <SpacingGrid
            label="Marge intérieure (padding)"
            top={pxToNum(style.paddingTop ?? style.padding)}
            right={pxToNum(style.paddingRight)}
            bottom={pxToNum(style.paddingBottom)}
            left={pxToNum(style.paddingLeft)}
            onChangeTop={(v) => onChange({ ...style, paddingTop: numToPx(v) })}
            onChangeRight={(v) => onChange({ ...style, paddingRight: numToPx(v) })}
            onChangeBottom={(v) => onChange({ ...style, paddingBottom: numToPx(v) })}
            onChangeLeft={(v) => onChange({ ...style, paddingLeft: numToPx(v) })}
          />
          <SpacingGrid
            label="Marge extérieure (margin)"
            top={pxToNum(style.marginTop)}
            right={pxToNum(style.marginRight)}
            bottom={pxToNum(style.marginBottom)}
            left={pxToNum(style.marginLeft)}
            onChangeTop={(v) => onChange({ ...style, marginTop: numToPx(v) })}
            onChangeRight={(v) => onChange({ ...style, marginRight: numToPx(v) })}
            onChangeBottom={(v) => onChange({ ...style, marginBottom: numToPx(v) })}
            onChangeLeft={(v) => onChange({ ...style, marginLeft: numToPx(v) })}
          />
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Couleur */}
      <CollapsibleStyleSection title="Couleur" id="sec-color">
        <BlockStack gap="300">
          <ColorField
            label="Couleur du contenu"
            value={style.color ?? ""}
            onChange={(v) => onChange({ ...style, color: v || undefined })}
          />
          <ColorField
            label="Arrière-plan"
            value={style.backgroundColor ?? ""}
            onChange={(v) => onChange({ ...style, backgroundColor: v || undefined })}
          />
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Bordure */}
      <CollapsibleStyleSection title="Bordure" id="sec-border">
        <BlockStack gap="300">
          <SliderNumericField
            label="Épaisseur"
            value={pxToNum(style.borderWidth) ?? 0}
            onChange={(v) => onChange({ ...style, borderWidth: v ? `${v}px` : undefined })}
            min={0}
            max={10}
          />
          <ColorField
            label="Couleur"
            value={style.borderColor ?? ""}
            onChange={(v) => onChange({ ...style, borderColor: v || undefined })}
          />
          <SliderNumericField
            label="Rayon"
            value={pxToNum(style.borderRadius) ?? 0}
            onChange={(v) => onChange({ ...style, borderRadius: v ? `${v}px` : undefined })}
            min={0}
            max={50}
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
          { label: "Personnalisé", value: "custom" },
        ]}
        value={currentPreset}
        onChange={(v) => onPatch({ preset: v as StepBarBlock["preset"] } as Partial<StorefrontBlockV2>)}
      />

      {(currentPreset === "custom" || currentPreset === "circles") && (
        <CollapsibleStyleSection title="Couleurs" id="sec-stepbar-colors" defaultOpen>
          <BlockStack gap="300">
            <Checkbox
              label="Afficher la ligne entre les étapes"
              checked={style.showLine !== false}
              onChange={(v) => patchStyle({ showLine: v })}
            />
            {style.showLine !== false && (
              <ColorField
                label="Couleur de la ligne"
                value={style.lineColor ?? ""}
                onChange={(v) => patchStyle({ lineColor: v || undefined })}
              />
            )}
            <ColorField
              label="Fond étape active"
              value={style.activeBg ?? ""}
              onChange={(v) => patchStyle({ activeBg: v || undefined })}
            />
            <ColorField
              label="Fond étape terminée"
              value={style.completedBg ?? ""}
              onChange={(v) => patchStyle({ completedBg: v || undefined })}
            />
            <InlineGrid columns={2} gap="300">
              <ColorField
                label="Fond au survol"
                value={style.hoverBg ?? ""}
                onChange={(v) => patchStyle({ hoverBg: v || undefined })}
              />
              <ColorField
                label="Texte au survol"
                value={style.hoverTextColor ?? ""}
                onChange={(v) => patchStyle({ hoverTextColor: v || undefined })}
              />
            </InlineGrid>
            <ColorField
              label="Fond étape inactive"
              value={style.inactiveBg ?? ""}
              onChange={(v) => patchStyle({ inactiveBg: v || undefined })}
            />
            <ColorField
              label="Couleur texte (active)"
              value={style.activeTextColor ?? ""}
              onChange={(v) => patchStyle({ activeTextColor: v || undefined })}
            />
            <ColorField
              label="Couleur texte (inactive)"
              value={style.inactiveTextColor ?? ""}
              onChange={(v) => patchStyle({ inactiveTextColor: v || undefined })}
            />
            <ColorField
              label="Couleur étiquettes étapes"
              value={style.labelColor ?? ""}
              onChange={(v) => patchStyle({ labelColor: v || undefined })}
            />
            <TextField
              label="Taille texte étiquettes"
              value={style.fontSize ?? ""}
              onChange={(v) => patchStyle({ fontSize: v || undefined })}
              placeholder="ex: 14px ou 1rem"
              autoComplete="off"
            />
          </BlockStack>
        </CollapsibleStyleSection>
      )}
    </BlockStack>
  );
}

/* ────────────────────── Image Upload via Shopify Files ────────────────────── */

type UploadJson = {
  ok?: boolean;
  imageUrl?: string;
  imageGid?: string;
};

function ImageUploadField({
  label,
  imageUrl,
  onImageChange,
}: {
  label: string;
  imageUrl: string | null;
  onImageChange: (url: string | null, gid?: string) => void;
}) {
  const uploadFetcher = useFetcher<UploadJson>();

  // When upload completes, update the image
  if (
    uploadFetcher.state === "idle" &&
    uploadFetcher.data?.ok &&
    uploadFetcher.data.imageUrl
  ) {
    // Trigger the change
    onImageChange(uploadFetcher.data.imageUrl, uploadFetcher.data.imageGid);
  }

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      const form = new FormData();
      form.append("file", file);
      uploadFetcher.submit(form, {
        method: "post",
        action: "/api/upload-file",
        encType: "multipart/form-data",
      });
    },
    [uploadFetcher],
  );

  const uploading = uploadFetcher.state !== "idle";

  return (
    <BlockStack gap="200">
      <Text as="span" variant="bodyMd">{label}</Text>
      {imageUrl ? (
        <BlockStack gap="200">
          <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--p-color-border)" }}>
            <img src={imageUrl} alt="" style={{ width: "100%", display: "block" }} />
          </div>
          <InlineStack gap="200">
            <Button size="slim" onClick={() => onImageChange(null)}>
              Retirer
            </Button>
          </InlineStack>
        </BlockStack>
      ) : (
        <DropZone
          onDrop={handleDrop}
          allowMultiple={false}
          type="image"
          label=""
          labelHidden
        >
          <DropZone.FileUpload
            actionTitle={uploading ? "Envoi..." : "Importer une image"}
            actionHint="ou glissez-déposez"
          />
        </DropZone>
      )}
    </BlockStack>
  );
}

/* ────────────────────── Product List Settings ────────────────────── */

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
  const columns = block.columns ?? 3;
  const cardLayout = block.cardLayout ?? "classic";

  const enrichVariants = (gids: string[]) => {
    if (gids.length === 0) return;
    const params = new URLSearchParams();
    gids.forEach((g) => params.append("ids", g));
    variantsMetaFetcher.load(`/api/shopify-variants?${params.toString()}`);
  };

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
      const changed = enriched.some((e, i) => {
        const prev = products[i];
        return prev && (e.displayName !== prev.displayName || e.imageUrl !== prev.imageUrl || e.productHandle !== prev.productHandle);
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
      const variantGid = firstId.startsWith("gid://") ? firstId : `gid://shopify/ProductVariant/${firstId}`;
      if (existing.has(variantGid)) continue;
      existing.add(variantGid);
      const title = (typeof p.title === "string" && p.title.trim()) || (typeof p.handle === "string" && p.handle.trim()) || variantGid;
      const imageUrl = (p.image && typeof (p.image as { url?: unknown }).url === "string" ? ((p.image as { url: string }).url as string) : null) || null;
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
      {/* Layout settings */}
      <CollapsibleStyleSection title="Mise en page" id="sec-pl-layout" defaultOpen>
        <BlockStack gap="300">
          <Select
            label="Style de carte"
            options={[
              { label: "Classique (bouton Ajouter)", value: "classic" },
              { label: "Overlay (bouton au survol)", value: "overlay" },
            ]}
            value={cardLayout}
            onChange={(v) => onPatch({ cardLayout: v as ProductListBlock["cardLayout"] } as Partial<StorefrontBlockV2>)}
          />
          <TextField
            label="Texte du bouton"
            value={block.buttonText ?? "Ajouter"}
            onChange={(v) => onPatch({ buttonText: v } as Partial<StorefrontBlockV2>)}
            placeholder="ex: Ajouter"
            autoComplete="off"
          />
          <InlineGrid columns={2} gap="300">
            <ColorField
              label="Fond du bouton"
              value={block.buttonBackground ?? ""}
              onChange={(v) => onPatch({ buttonBackground: v || undefined } as Partial<StorefrontBlockV2>)}
            />
            <ColorField
              label="Couleur texte"
              value={block.buttonColor ?? ""}
              onChange={(v) => onPatch({ buttonColor: v || undefined } as Partial<StorefrontBlockV2>)}
            />
          </InlineGrid>
          <InlineGrid columns={["oneHalf", "oneHalf"]} gap="200">
            <SliderNumericField
              label="Colonnes (Bureau)"
              value={columns}
              onChange={(v) => onPatch({ columns: v } as Partial<StorefrontBlockV2>)}
              min={1}
              max={6}
              suffix=""
            />
            <SliderNumericField
              label="Colonnes (Mobile)"
              value={block.columnsMobile ?? 2}
              onChange={(v) => onPatch({ columnsMobile: v } as Partial<StorefrontBlockV2>)}
              min={1}
              max={3}
              suffix=""
            />
          </InlineGrid>
        </BlockStack>
      </CollapsibleStyleSection>

      {/* Source */}
      <BlockStack gap="200">
        <Text as="span" variant="bodyMd">Type de source</Text>
        <Box>
          <ButtonGroup variant="segmented" fullWidth>
            <Button
              pressed={source === "step_pick"}
              onClick={() => onPatch({ source: "step_pick" } as Partial<StorefrontBlockV2>)}
            >
              Produits
            </Button>
            <Button
              pressed={source === "collection"}
              onClick={() => onPatch({ source: "collection" } as Partial<StorefrontBlockV2>)}
            >
              Collections
            </Button>
            <Button
              pressed={source === "all_products"}
              onClick={() => onPatch({ source: "all_products" } as Partial<StorefrontBlockV2>)}
            >
              Tous les produits
            </Button>
          </ButtonGroup>
        </Box>
      </BlockStack>

      {source === "collection" ? (
        <BlockStack gap="200">
          <Box
            padding="300"
            borderWidth="025"
            borderColor="border"
            borderRadius="200"
            background="bg-surface"
          >
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Collection sélectionnée
                </Text>
                {block.collectionHandle && (
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={() => onPatch({ collectionHandle: undefined } as Partial<StorefrontBlockV2>)}
                  >
                    Retirer
                  </Button>
                )}
              </InlineStack>
              {block.collectionHandle ? (
                <Text as="p" fontWeight="semibold" variant="bodyMd">
                  /collections/{block.collectionHandle}
                </Text>
              ) : (
                <Text as="p" variant="bodySm" tone="critical">
                  Aucune collection choisie
                </Text>
              )}
            </BlockStack>
          </Box>
          <Button
            onClick={async () => {
              const selected = await shopifyBridge.resourcePicker({
                type: "collection",
                multiple: false,
                action: "select",
              });
              const sel = (selected as { selection?: Array<{ handle?: string }> } | null)?.selection?.[0];
              if (sel?.handle) {
                onPatch({ collectionHandle: String(sel.handle) } as Partial<StorefrontBlockV2>);
              }
            }}
          >
            {block.collectionHandle ? "Modifier la collection" : "Sélectionner une collection"}
          </Button>
        </BlockStack>
      ) : source === "all_products" ? (
        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Tous les produits de votre boutique seront affichés dans ce bloc.
          </Text>
        </Box>
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
                Aucun produit sélectionné. Utilisez les boutons ci-dessus.
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
                      {p.minQuantity != null || p.maxQuantity != null ? (
                        <Text as="p" variant="bodySm" tone="subdued">
                          Qté : {p.minQuantity ?? 0} - {p.maxQuantity ?? "∞"}
                        </Text>
                      ) : null}
                    </div>
                    <Tooltip content="Retirer">
                      <Button
                        icon={DeleteIcon}
                        variant="plain"
                        tone="critical"
                        onClick={() => onStepProductsChange(products.filter((_, k) => k !== pi))}
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

/* ────────────────────── Options Supplémentaires (Upsell) Manager ────────────────────── */

function UpsellManager({
  block,
  onPatch,
}: {
  block: StorefrontBlockV2;
  onPatch: (patch: Partial<StorefrontBlockV2>) => void;
}) {
  const shopifyBridge = useAppBridge();
  if (block.type !== "upsell") return null;

  const items = block.items ?? [];

  const patchItems = (newItems: any[]) => {
    onPatch({ items: newItems } as Partial<StorefrontBlockV2>);
  };

  const openPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "variant",
      multiple: true,
      action: "add",
    });
    const variants = variantsFromPickerSafe(selected);
    if (!variants.length) return;

    const newItems = [...items];
    variants.forEach((v: any) => {
      // Check if already exists
      if (newItems.some((it) => it.variantGid === v.id)) return;

      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        variantGid: v.id,
        variantId: parseInt(v.id.split("/").pop() || "0"),
        productTitle: v.displayName || "Produit",
        priceAmount: v.price || "0.00",
        currencyCode: "EUR",
        defaultImageUrl: v.image?.url ?? "",
        defaultEnabled: false,
      });
    });
    patchItems(newItems);
  };

  const removeItem = (idx: number) => {
    const next = [...items];
    next.splice(idx, 1);
    patchItems(next);
  };

  const updateItem = (idx: number, patch: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    patchItems(next);
  };

  return (
    <BlockStack gap="400">
      <TextField
        label="Titre du bloc"
        value={block.title}
        onChange={(v) => onPatch({ title: v } as Partial<StorefrontBlockV2>)}
        autoComplete="off"
      />
      <Select
        label="Comportement"
        options={[
          { label: "Choix multiple (Cases à cocher)", value: "multiple" },
          { label: "Choix unique (Boutons radio)", value: "single" },
        ]}
        value={block.behavior}
        onChange={(v) => onPatch({ behavior: v as "single" | "multiple" } as Partial<StorefrontBlockV2>)}
      />

      <Divider />

      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">Options (Items)</Text>
          <Button variant="plain" onClick={openPicker} icon={PlusIcon}>Ajouter un produit</Button>
        </InlineStack>

        {items.length === 0 && (
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <Text as="p" variant="bodySm" tone="subdued">Aucune option. Sélectionnez un produit Shopify.</Text>
          </Box>
        )}

        {items.map((item, idx) => (
          <Box key={item.id} padding="300" background="bg-surface" borderStyle="solid" borderWidth="025" borderColor="border" borderRadius="200">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  {item.defaultImageUrl && <Thumbnail source={item.defaultImageUrl} alt="" size="small" />}
                  <BlockStack gap="050">
                    <Text as="span" variant="bodySm" fontWeight="bold">{item.productTitle}</Text>
                    <Text as="span" variant="bodyXs" tone="subdued">{item.priceAmount} {item.currencyCode}</Text>
                  </BlockStack>
                </InlineStack>
                <Button variant="plain" icon={DeleteIcon} tone="critical" onClick={() => removeItem(idx)} />
              </InlineStack>

              <TextField
                label="Libellé de remplacement"
                value={item.overrideLabel ?? ""}
                onChange={(v) => updateItem(idx, { overrideLabel: v })}
                placeholder={item.productTitle}
                autoComplete="off"
              />

              <TextField
                label="Description courte"
                value={item.shortDescription ?? ""}
                onChange={(v) => updateItem(idx, { shortDescription: v })}
                placeholder="Ex: Emballage cadeau luxe"
                autoComplete="off"
              />

              <Checkbox
                label="Activé par défaut"
                checked={item.defaultEnabled}
                onChange={(v) => updateItem(idx, { defaultEnabled: v })}
              />
            </BlockStack>
          </Box>
        ))}
      </BlockStack>
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
        <ImageUploadField
          label="Image"
          imageUrl={block.url}
          onImageChange={(url) => onPatch({ url })}
        />
        <TextField
          label="Texte alternatif (alt)"
          value={block.alt}
          onChange={(v) => onPatch({ alt: v })}
          autoComplete="off"
        />
      </BlockStack>
    );
  }
  if (block.type === "spacer") {
    return (
      <SliderNumericField
        label="Hauteur"
        value={block.height}
        onChange={(v) => onPatch({ height: Math.max(0, v) })}
        min={0}
        max={200}
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
        <ImageUploadField
          label="Image"
          imageUrl={block.imageUrl}
          onImageChange={(url) => onPatch({ imageUrl: url })}
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
        <ImageUploadField
          label="Image"
          imageUrl={block.imageUrl}
          onImageChange={(url) => onPatch({ imageUrl: url })}
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
        <InlineStack gap="200" blockAlign="center">
          <Button icon={ArrowLeftIcon} variant="plain" onClick={onBack} accessibilityLabel="Retour" />
          <Text as="p" tone="subdued" variant="bodySm">
            Bloc introuvable.
          </Text>
        </InlineStack>
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

      {/* Editable block name */}
      <TextField
        label="Nom de la section"
        value={(block as { name?: string }).name ?? ""}
        onChange={(v) => patchBlock({ name: v || undefined } as Partial<StorefrontBlockV2>)}
        autoComplete="off"
        placeholder={blockDisplayLabel(block)}
        helpText="Nom affiché dans la sidebar"
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
        Les variables CSS Shopify s'adaptent automatiquement au thème.
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
        { id: "general", content: "Générale", accessibilityLabel: "Générale" },
        { id: "style", content: "Style", accessibilityLabel: "Style" },
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

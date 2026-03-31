/**
 * JSON body for POST /app/bundle/:id — must stay aligned with parseBundlePayload (bundle.server).
 */
import {
  defaultStorefrontDesign,
  migrateStorefrontDesign,
  type ProductStyleOverrides,
  type StorefrontDesignV2,
} from "./storefront-design";

export type BundleGalleryItemApi = {
  url: string;
  mediaGid?: string | null;
};

export type UiBundleGalleryItem = {
  key: string;
  url: string;
  mediaGid: string | null;
};

export function newGalleryItemKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type BundleSubmitPayload = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageGid?: string | null;
  bundleGallery?: BundleGalleryItemApi[];
  /** Vide = slug dérivé du nom côté serveur */
  productHandle?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  storefrontDesign?: StorefrontDesignV2;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  bundlePricingMode: string;
  fixedBoxItemCount?: number | null;
  pricingModeMedia?: Record<string, unknown> | null;
  pricingScope: string;
  discountValueType: string;
  flatDiscountValue?: string | number | null;
  showCompareAtPrice?: boolean;
  showFixedPriceOnLoad?: boolean;
  allowZeroTotal?: boolean;
  minTotalItemCount?: number | null;
  maxTotalItemCount?: number | null;
  minBundleCartValue?: string | number | null;
  maxBundleCartValue?: string | number | null;
  pricingTiers: Array<{
    sortOrder?: number;
    thresholdBasis: string;
    thresholdMin: string | number;
    thresholdMax?: string | number | null;
    tierValue: string | number;
  }>;
  steps: Array<{
    sortOrder?: number;
    name?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    imageGid?: string | null;
    isFinalStep?: boolean;
    products: Array<{
      variantGid: string;
      sortOrder?: number;
      minQuantity?: number | null;
      maxQuantity?: number | null;
      productHandle?: string | null;
      layoutPreset?: string;
      styleOverrides?: ProductStyleOverrides | null;
    }>;
    rules: Array<{
      sortOrder?: number;
      metric: string;
      operator: string;
      value: string | number;
      targetVariantGid?: string | null;
    }>;
    lineItemProperties: Array<{
      sortOrder?: number;
      fieldType: string;
      label: string;
      propertyKey: string;
      required?: boolean;
      defaultChecked?: boolean;
      placeholder?: string | null;
    }>;
  }>;
};

/** Client-side form model (strings for numeric inputs). */
export type UiStepProduct = {
  variantGid: string;
  sortOrder: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  displayName: string;
  imageUrl: string | null;
  /** Handle produit Shopify (variant picker / URL produit.js) */
  productHandle: string | null;
  layoutPreset: string;
  styleOverrides: ProductStyleOverrides | null;
};

export type UiPricingTier = {
  sortOrder: number;
  thresholdBasis: "ITEM_COUNT" | "CART_VALUE";
  thresholdMin: string;
  thresholdMax: string;
  tierValue: string;
};

export type UiStepRule = {
  sortOrder: number;
  metric: string;
  operator: string;
  value: string;
  targetVariantGid: string;
};

export type UiLineItemProperty = {
  sortOrder: number;
  fieldType: "CHECKBOX" | "TEXT";
  label: string;
  propertyKey: string;
  required: boolean;
  defaultChecked: boolean;
  placeholder: string;
};

export type UiStep = {
  sortOrder: number;
  name: string;
  description: string;
  imageUrl: string | null;
  imageGid: string | null;
  isFinalStep: boolean;
  products: UiStepProduct[];
  rules: UiStepRule[];
  lineItemProperties: UiLineItemProperty[];
};

export type BundleFormState = {
  name: string;
  description: string;
  bundleGallery: UiBundleGalleryItem[];
  /** Laisser vide pour URL auto depuis le nom */
  productHandle: string;
  seoTitle: string;
  seoDescription: string;
  storefrontDesign: StorefrontDesignV2;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED" | "UNLISTED";
  bundlePricingMode: "STANDARD" | "FIXED_PRICE_BOX" | "TIERED";
  /** Remise % ou montant (mode STANDARD uniquement) */
  standardDiscountType: "PERCENT" | "FIXED_AMOUNT";
  fixedBoxItemCount: string;
  discountValueType: "PERCENT" | "FIXED_AMOUNT" | "FIXED_PRICE";
  flatDiscountValue: string;
  showCompareAtPrice: boolean;
  showFixedPriceOnLoad: boolean;
  allowZeroTotal: boolean;
  minTotalItemCount: string;
  maxTotalItemCount: string;
  minBundleCartValue: string;
  maxBundleCartValue: string;
  pricingTiers: UiPricingTier[];
  steps: UiStep[];
};

export type SerializedBundle = {
  id: string | null;
  bundleUid: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageGid?: string | null;
  bundleGallery?: BundleGalleryItemApi[] | null;
  shopifyProductId?: string | null;
  shopifyParentVariantId?: string | null;
  productHandle?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  storefrontDesign?: unknown;
  status: string;
  bundlePricingMode?: string | null;
  fixedBoxItemCount?: number | null;
  pricingModeMedia?: unknown;
  pricingScope: string;
  discountValueType: string;
  flatDiscountValue?: string | null;
  showCompareAtPrice?: boolean;
  showFixedPriceOnLoad?: boolean;
  allowZeroTotal?: boolean;
  minTotalItemCount?: number | null;
  maxTotalItemCount?: number | null;
  minBundleCartValue?: string | null;
  maxBundleCartValue?: string | null;
  pricingTiers?: Array<{
    sortOrder?: number;
    thresholdBasis: string;
    thresholdMin: string;
    thresholdMax?: string | null;
    tierValue: string;
  }>;
  steps?: Array<{
    sortOrder?: number;
    name?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    imageGid?: string | null;
    isFinalStep?: boolean;
    products?: Array<{
      variantGid: string;
      sortOrder?: number;
      minQuantity?: number | null;
      maxQuantity?: number | null;
      productHandle?: string | null;
      layoutPreset?: string;
      styleOverrides?: unknown;
    }>;
    rules?: Array<{
      sortOrder?: number;
      metric: string;
      operator: string;
      value: string;
      targetVariantGid?: string | null;
    }>;
    lineItemProperties?: Array<{
      sortOrder?: number;
      fieldType: string;
      label: string;
      propertyKey: string;
      required?: boolean;
      defaultChecked?: boolean;
      placeholder?: string | null;
    }>;
  }>;
};

function parseStorefrontDesign(raw: unknown): StorefrontDesignV2 {
  if (raw === undefined || raw === null) {
    return defaultStorefrontDesign();
  }
  return migrateStorefrontDesign(raw);
}

export function emptyStep(sortOrder: number): UiStep {
  return {
    sortOrder,
    name: "",
    description: "",
    imageUrl: null,
    imageGid: null,
    isFinalStep: false,
    products: [],
    rules: [],
    lineItemProperties: [],
  };
}

function inferBundlePricingMode(b: SerializedBundle): BundleFormState["bundlePricingMode"] {
  const m = b.bundlePricingMode?.trim();
  if (m === "FIXED_PRICE_BOX" || m === "TIERED" || m === "STANDARD") {
    return m;
  }
  if (b.pricingScope === "TIERED") return "TIERED";
  if (b.discountValueType === "FIXED_PRICE") return "FIXED_PRICE_BOX";
  return "STANDARD";
}

function bundleGalleryToUi(bundle: SerializedBundle): UiBundleGalleryItem[] {
  const raw = bundle.bundleGallery;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: UiBundleGalleryItem[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      if (!/^https?:\/\//i.test(url)) continue;
      const mediaGid =
        typeof item.mediaGid === "string" && item.mediaGid.trim()
          ? item.mediaGid.trim()
          : null;
      out.push({ key: newGalleryItemKey(), url, mediaGid });
    }
    if (out.length) return out;
  }
  if (bundle.imageUrl && /^https?:\/\//i.test(bundle.imageUrl.trim())) {
    const gid =
      typeof bundle.imageGid === "string" && bundle.imageGid.trim()
        ? bundle.imageGid.trim()
        : null;
    return [
      { key: newGalleryItemKey(), url: bundle.imageUrl.trim(), mediaGid: gid },
    ];
  }
  return [];
}

export function toFormState(bundle: SerializedBundle): BundleFormState {
  const mode = inferBundlePricingMode(bundle);
  const tiers = mode === "TIERED" ? bundle.pricingTiers ?? [] : [];
  const steps = bundle.steps ?? [];

  const standardDiscountType: BundleFormState["standardDiscountType"] =
    bundle.discountValueType === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENT";

  return {
    name: bundle.name ?? "",
    description: bundle.description ?? "",
    bundleGallery: bundleGalleryToUi(bundle),
    productHandle: bundle.productHandle ?? "",
    seoTitle: bundle.seoTitle ?? "",
    seoDescription: bundle.seoDescription ?? "",
    storefrontDesign: parseStorefrontDesign(bundle.storefrontDesign),
    status: (bundle.status as BundleFormState["status"]) || "DRAFT",
    bundlePricingMode: mode,
    standardDiscountType,
    fixedBoxItemCount:
      bundle.fixedBoxItemCount != null ? String(bundle.fixedBoxItemCount) : "",
    discountValueType:
      (bundle.discountValueType as BundleFormState["discountValueType"]) || "PERCENT",
    flatDiscountValue:
      bundle.flatDiscountValue != null && bundle.flatDiscountValue !== ""
        ? String(bundle.flatDiscountValue)
        : "",
    showCompareAtPrice: bundle.showCompareAtPrice ?? true,
    showFixedPriceOnLoad: bundle.showFixedPriceOnLoad ?? false,
    allowZeroTotal: bundle.allowZeroTotal ?? false,
    minTotalItemCount:
      bundle.minTotalItemCount != null ? String(bundle.minTotalItemCount) : "",
    maxTotalItemCount:
      bundle.maxTotalItemCount != null ? String(bundle.maxTotalItemCount) : "",
    minBundleCartValue:
      bundle.minBundleCartValue != null ? String(bundle.minBundleCartValue) : "",
    maxBundleCartValue:
      bundle.maxBundleCartValue != null ? String(bundle.maxBundleCartValue) : "",
    pricingTiers: tiers.map((t, i) => ({
      sortOrder: t.sortOrder ?? i,
      thresholdBasis: (t.thresholdBasis as UiPricingTier["thresholdBasis"]) || "ITEM_COUNT",
      thresholdMin: String(t.thresholdMin ?? ""),
      thresholdMax:
        t.thresholdMax != null && t.thresholdMax !== "" ? String(t.thresholdMax) : "",
      tierValue: String(t.tierValue ?? ""),
    })),
    steps: steps.map((s, si) => ({
      sortOrder: s.sortOrder ?? si,
      name: s.name ?? "",
      description: s.description ?? "",
      imageUrl: s.imageUrl ?? null,
      imageGid: s.imageGid ?? null,
      isFinalStep: s.isFinalStep ?? false,
      products: (s.products ?? []).map((p, pi) => ({
        variantGid: p.variantGid,
        sortOrder: p.sortOrder ?? pi,
        minQuantity: p.minQuantity ?? null,
        maxQuantity: p.maxQuantity ?? null,
        displayName: p.variantGid.split("/").pop() ?? p.variantGid,
        imageUrl: null,
        productHandle: p.productHandle ?? null,
        layoutPreset: p.layoutPreset ?? "STACK_ADD_TO_QTY",
        styleOverrides:
          p.styleOverrides && typeof p.styleOverrides === "object"
            ? (p.styleOverrides as ProductStyleOverrides)
            : null,
      })),
      rules: (s.rules ?? []).map((r, ri) => ({
        sortOrder: r.sortOrder ?? ri,
        metric: r.metric,
        operator: r.operator,
        value: String(r.value ?? ""),
        targetVariantGid: r.targetVariantGid ?? "",
      })),
      lineItemProperties: (s.lineItemProperties ?? []).map((lp, li) => ({
        sortOrder: lp.sortOrder ?? li,
        fieldType: (lp.fieldType as UiLineItemProperty["fieldType"]) || "TEXT",
        label: lp.label,
        propertyKey: lp.propertyKey,
        required: lp.required ?? false,
        defaultChecked: lp.defaultChecked ?? false,
        placeholder: lp.placeholder ?? "",
      })),
    })),
  };
}

export function emptyPricingTier(index: number): UiPricingTier {
  return {
    sortOrder: index,
    thresholdBasis: "ITEM_COUNT",
    thresholdMin: "0",
    thresholdMax: "",
    tierValue: "0",
  };
}

export function toApiPayload(form: BundleFormState): BundleSubmitPayload {
  const intOrNull = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? null : n;
  };

  const decimalOrNull = (s: string): string | null => {
    const t = s.trim();
    return t.length ? t : null;
  };

  const pricingScope = form.bundlePricingMode === "TIERED" ? "TIERED" : "FLAT";
  const discountValueType =
    form.bundlePricingMode === "FIXED_PRICE_BOX"
      ? "FIXED_PRICE"
      : form.bundlePricingMode === "STANDARD"
        ? form.standardDiscountType
        : form.discountValueType;

  const primary = form.bundleGallery[0];
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    imageUrl: primary?.url ?? null,
    imageGid: primary?.mediaGid ?? null,
    bundleGallery: form.bundleGallery.map(({ url, mediaGid }) => ({
      url,
      mediaGid: mediaGid ?? null,
    })),
    productHandle: form.productHandle.trim(),
    seoTitle: form.seoTitle.trim() || null,
    seoDescription: form.seoDescription.trim() || null,
    storefrontDesign: form.storefrontDesign,
    status: form.status,
    bundlePricingMode: form.bundlePricingMode,
    fixedBoxItemCount:
      form.bundlePricingMode === "FIXED_PRICE_BOX"
        ? intOrNull(form.fixedBoxItemCount)
        : null,
    pricingModeMedia: null,
    pricingScope,
    discountValueType,
    flatDiscountValue: form.flatDiscountValue.trim() || null,
    showCompareAtPrice: form.showCompareAtPrice,
    showFixedPriceOnLoad: form.showFixedPriceOnLoad,
    allowZeroTotal: form.allowZeroTotal,
    minTotalItemCount: intOrNull(form.minTotalItemCount),
    maxTotalItemCount: intOrNull(form.maxTotalItemCount),
    minBundleCartValue: decimalOrNull(form.minBundleCartValue),
    maxBundleCartValue: decimalOrNull(form.maxBundleCartValue),
    pricingTiers:
      form.bundlePricingMode === "TIERED"
        ? form.pricingTiers.map((t, i) => ({
            sortOrder: i,
            thresholdBasis: t.thresholdBasis,
            thresholdMin: t.thresholdMin,
            thresholdMax: t.thresholdMax.trim() || null,
            tierValue: t.tierValue,
          }))
        : [],
    steps: form.steps.map((s, si) => ({
      sortOrder: si,
      name: s.name.trim() || null,
      description: s.description.trim() || null,
      imageUrl: s.imageUrl,
      imageGid: s.imageGid,
      isFinalStep: s.isFinalStep,
      products: s.products.map((p, pi) => ({
        variantGid: p.variantGid,
        sortOrder: pi,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
        productHandle: p.productHandle?.trim() || null,
        layoutPreset: p.layoutPreset,
        styleOverrides: p.styleOverrides,
      })),
      rules: s.rules.map((r, ri) => ({
        sortOrder: ri,
        metric: r.metric,
        operator: r.operator,
        value: r.value,
        targetVariantGid:
          r.metric === "VARIANT_QUANTITY" && r.targetVariantGid.trim()
            ? r.targetVariantGid.trim()
            : null,
      })),
      lineItemProperties: s.lineItemProperties.map((lp, li) => ({
        sortOrder: li,
        fieldType: lp.fieldType,
        label: lp.label,
        propertyKey: lp.propertyKey,
        required: lp.required,
        defaultChecked: lp.defaultChecked,
        placeholder: lp.placeholder.trim() || null,
      })),
    })),
  };
}

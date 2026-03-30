import {
  defaultStorefrontDesign,
  normalizeLayoutPreset,
  normalizeProductHandle,
  slugifyProductHandle,
} from "./storefront-design";
import {
  Prisma,
  type PrismaClient,
  type BundlePricingMode,
  type BundleStatus,
  type DiscountValueType,
  type LineItemPropertyFieldType,
  type PricingScope,
  type StepRuleMetric,
  type StepRuleOperator,
  type ThresholdBasis,
} from "@prisma/client";

const BUNDLE_STATUSES: BundleStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];
const PRICING_SCOPES: PricingScope[] = ["FLAT", "TIERED"];
const BUNDLE_PRICING_MODES: BundlePricingMode[] = [
  "STANDARD",
  "FIXED_PRICE_BOX",
  "TIERED",
  "PREDEFINED_SIZES",
];
const STANDARD_DISCOUNT_TYPES: DiscountValueType[] = ["PERCENT", "FIXED_AMOUNT"];
const DISCOUNT_VALUE_TYPES: DiscountValueType[] = [
  "PERCENT",
  "FIXED_AMOUNT",
  "FIXED_PRICE",
];
const THRESHOLD_BASES: ThresholdBasis[] = ["ITEM_COUNT", "CART_VALUE"];
const STEP_RULE_METRICS: StepRuleMetric[] = [
  "BUNDLE_PRICE",
  "TOTAL_ITEM_COUNT",
  "VARIANT_QUANTITY",
  "DISTINCT_VARIANT_COUNT",
];
const STEP_RULE_OPERATORS: StepRuleOperator[] = [
  "LT",
  "LTE",
  "EQ",
  "GTE",
  "GT",
];
const LINE_ITEM_FIELD_TYPES: LineItemPropertyFieldType[] = ["CHECKBOX", "TEXT"];

export type BundleListItem = {
  id: string;
  name: string;
  status: BundleStatus;
};

export type LineItemPropertyPayload = {
  sortOrder?: number;
  fieldType: string;
  label: string;
  propertyKey: string;
  required?: boolean;
  defaultChecked?: boolean;
  placeholder?: string | null;
};

export type StepRulePayload = {
  sortOrder?: number;
  metric: string;
  operator: string;
  value: string | number;
  targetVariantGid?: string | null;
};

export type StepProductPayload = {
  variantGid: string;
  sortOrder?: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  productHandle?: string | null;
  layoutPreset?: string;
  styleOverrides?: unknown;
};

export type StepPayload = {
  sortOrder?: number;
  name?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageGid?: string | null;
  isFinalStep?: boolean;
  products?: StepProductPayload[];
  rules?: StepRulePayload[];
  lineItemProperties?: LineItemPropertyPayload[];
};

export type PricingTierPayload = {
  sortOrder?: number;
  thresholdBasis: string;
  thresholdMin: string | number;
  thresholdMax?: string | number | null;
  tierValue: string | number;
};

export type BundleWritePayload = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  imageGid?: string | null;
  status?: BundleStatus;
  /** Slug /products/{handle} — toujours défini côté parse (défaut = nom slugifié) */
  productHandle: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  storefrontDesign: Prisma.InputJsonValue;
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
  bundlePricingMode: string;
  fixedBoxItemCount?: number | null;
  pricingModeMedia?: Prisma.InputJsonValue | null;
  pricingTiers?: PricingTierPayload[];
  steps?: StepPayload[];
};

function isEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function toDecimal(
  value: string | number | null | undefined,
  field: string,
): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  if (!s.length) return null;
  try {
    return new Prisma.Decimal(s);
  } catch {
    throw Response.json({ error: `Invalid decimal for ${field}` }, { status: 400 });
  }
}

function requireDecimal(
  value: string | number | null | undefined,
  field: string,
): Prisma.Decimal {
  const d = toDecimal(value, field);
  if (d === null) {
    throw Response.json(
      { error: `Missing or invalid decimal for ${field}` },
      { status: 400 },
    );
  }
  return d;
}

export function parseBundlePayload(body: unknown): BundleWritePayload {
  if (!body || typeof body !== "object") {
    throw Response.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) {
    throw Response.json({ error: "name is required" }, { status: 400 });
  }
  if (o.status !== undefined && !isEnum(o.status, BUNDLE_STATUSES)) {
    throw Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const bundlePricingMode: BundlePricingMode = isEnum(
    o.bundlePricingMode,
    BUNDLE_PRICING_MODES,
  )
    ? o.bundlePricingMode
    : o.pricingScope === "TIERED"
      ? "TIERED"
      : o.pricingScope === "FLAT" && o.discountValueType === "FIXED_PRICE"
        ? "FIXED_PRICE_BOX"
        : "STANDARD";

  if (bundlePricingMode === "PREDEFINED_SIZES") {
    throw Response.json(
      {
        error:
          "Le mode « tailles de boîte prédéfinies » n'est pas encore disponible (phase 2).",
      },
      { status: 400 },
    );
  }

  let pricingScope: PricingScope;
  let discountValueType: DiscountValueType;

  if (bundlePricingMode === "TIERED") {
    pricingScope = "TIERED";
    if (!isEnum(o.discountValueType, DISCOUNT_VALUE_TYPES)) {
      throw Response.json({ error: "Invalid discountValueType" }, { status: 400 });
    }
    discountValueType = o.discountValueType;
  } else if (bundlePricingMode === "FIXED_PRICE_BOX") {
    pricingScope = "FLAT";
    discountValueType = "FIXED_PRICE";
  } else {
    pricingScope = "FLAT";
    if (isEnum(o.discountValueType, STANDARD_DISCOUNT_TYPES)) {
      discountValueType = o.discountValueType;
    } else if (isEnum(o.discountValueType, DISCOUNT_VALUE_TYPES)) {
      discountValueType =
        o.discountValueType === "FIXED_PRICE" ? "PERCENT" : o.discountValueType;
    } else {
      discountValueType = "PERCENT";
    }
  }

  let fixedBoxItemCount: number | null = null;
  if (bundlePricingMode === "FIXED_PRICE_BOX") {
    const raw = o.fixedBoxItemCount;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? parseInt(raw, 10)
          : NaN;
    if (!Number.isInteger(n) || n < 1) {
      throw Response.json(
        {
          error:
            "Nombre d'articles (prix fixe) : indiquez un entier ≥ 1 pour ce mode.",
        },
        { status: 400 },
      );
    }
    fixedBoxItemCount = n;
    const priceVal = o.flatDiscountValue;
    if (
      priceVal === null ||
      priceVal === undefined ||
      priceVal === "" ||
      (typeof priceVal === "string" && !priceVal.trim())
    ) {
      throw Response.json(
        { error: "Prix fixe du pack : la valeur est requise pour ce mode." },
        { status: 400 },
      );
    }
  }

  let pricingModeMedia: Prisma.InputJsonValue | null = null;
  if (o.pricingModeMedia !== undefined && o.pricingModeMedia !== null) {
    if (typeof o.pricingModeMedia === "object" && !Array.isArray(o.pricingModeMedia)) {
      pricingModeMedia = o.pricingModeMedia as Prisma.InputJsonValue;
    }
  }

  const pricingTiers = Array.isArray(o.pricingTiers)
    ? (o.pricingTiers as PricingTierPayload[])
    : [];
  const steps = Array.isArray(o.steps) ? (o.steps as StepPayload[]) : [];

  if (pricingScope === "TIERED" && pricingTiers.length === 0) {
    throw Response.json(
      {
        error:
          "pricingTiers must contain at least one entry when pricingScope is TIERED",
      },
      { status: 400 },
    );
  }

  for (let i = 0; i < pricingTiers.length; i++) {
    const t = pricingTiers[i]!;
    if (!isEnum(t.thresholdBasis, THRESHOLD_BASES)) {
      throw Response.json(
        { error: `Invalid thresholdBasis on pricingTiers[${i}]` },
        { status: 400 },
      );
    }
    requireDecimal(t.thresholdMin, `pricingTiers[${i}].thresholdMin`);
    if (
      t.thresholdMax !== undefined &&
      t.thresholdMax !== null &&
      t.thresholdMax !== ""
    ) {
      requireDecimal(t.thresholdMax, `pricingTiers[${i}].thresholdMax`);
    }
    requireDecimal(t.tierValue, `pricingTiers[${i}].tierValue`);
  }

  for (let si = 0; si < steps.length; si++) {
    const step = steps[si]!;
    const products = Array.isArray(step.products) ? step.products : [];
    const rules = Array.isArray(step.rules) ? step.rules : [];
    const props = Array.isArray(step.lineItemProperties)
      ? step.lineItemProperties
      : [];

    for (let pi = 0; pi < products.length; pi++) {
      const p = products[pi]!;
      if (typeof p.variantGid !== "string" || !p.variantGid.trim()) {
        throw Response.json(
          { error: `steps[${si}].products[${pi}].variantGid is required` },
          { status: 400 },
        );
      }
      if (
        p.styleOverrides != null &&
        typeof p.styleOverrides !== "object"
      ) {
        throw Response.json(
          {
            error: `steps[${si}].products[${pi}].styleOverrides must be an object`,
          },
          { status: 400 },
        );
      }
    }

    for (let ri = 0; ri < rules.length; ri++) {
      const r = rules[ri]!;
      if (!isEnum(r.metric, STEP_RULE_METRICS)) {
        throw Response.json(
          { error: `Invalid metric on steps[${si}].rules[${ri}]` },
          { status: 400 },
        );
      }
      if (!isEnum(r.operator, STEP_RULE_OPERATORS)) {
        throw Response.json(
          { error: `Invalid operator on steps[${si}].rules[${ri}]` },
          { status: 400 },
        );
      }
      requireDecimal(r.value, `steps[${si}].rules[${ri}].value`);
      if (r.metric === "VARIANT_QUANTITY") {
        if (typeof r.targetVariantGid !== "string" || !r.targetVariantGid.trim()) {
          throw Response.json(
            {
              error: `steps[${si}].rules[${ri}].targetVariantGid is required when metric is VARIANT_QUANTITY`,
            },
            { status: 400 },
          );
        }
      }
    }

    for (let li = 0; li < props.length; li++) {
      const lp = props[li]!;
      if (!isEnum(lp.fieldType, LINE_ITEM_FIELD_TYPES)) {
        throw Response.json(
          { error: `Invalid fieldType on steps[${si}].lineItemProperties[${li}]` },
          { status: 400 },
        );
      }
      if (typeof lp.label !== "string" || !lp.label.trim()) {
        throw Response.json(
          { error: `steps[${si}].lineItemProperties[${li}].label is required` },
          { status: 400 },
        );
      }
      if (typeof lp.propertyKey !== "string" || !lp.propertyKey.trim()) {
        throw Response.json(
          {
            error: `steps[${si}].lineItemProperties[${li}].propertyKey is required`,
          },
          { status: 400 },
        );
      }
    }
  }

  const nameTrim = o.name.trim();
  const explicitHandle =
    typeof o.productHandle === "string" && o.productHandle.trim() !== ""
      ? normalizeProductHandle(o.productHandle)
      : null;
  const productHandle = explicitHandle ?? slugifyProductHandle(nameTrim);

  let storefrontDesign: Prisma.InputJsonValue =
    defaultStorefrontDesign() as unknown as Prisma.InputJsonValue;
  if (o.storefrontDesign !== undefined && o.storefrontDesign !== null) {
    if (typeof o.storefrontDesign === "object") {
      storefrontDesign = o.storefrontDesign as Prisma.InputJsonValue;
    }
  }

  return {
    name: nameTrim,
    description:
      typeof o.description === "string"
        ? o.description
        : o.description === null
          ? null
          : undefined,
    imageUrl:
      typeof o.imageUrl === "string"
        ? o.imageUrl
        : o.imageUrl === null
          ? null
          : undefined,
    imageGid:
      typeof o.imageGid === "string"
        ? o.imageGid
        : o.imageGid === null
          ? null
          : undefined,
    status: o.status as BundleStatus | undefined,
    bundlePricingMode,
    fixedBoxItemCount:
      bundlePricingMode === "FIXED_PRICE_BOX" ? fixedBoxItemCount : null,
    pricingModeMedia,
    pricingScope,
    discountValueType,
    flatDiscountValue: o.flatDiscountValue as string | number | null | undefined,
    showCompareAtPrice:
      typeof o.showCompareAtPrice === "boolean" ? o.showCompareAtPrice : undefined,
    showFixedPriceOnLoad:
      typeof o.showFixedPriceOnLoad === "boolean"
        ? o.showFixedPriceOnLoad
        : undefined,
    allowZeroTotal:
      typeof o.allowZeroTotal === "boolean" ? o.allowZeroTotal : undefined,
    minTotalItemCount:
      typeof o.minTotalItemCount === "number" && Number.isInteger(o.minTotalItemCount)
        ? o.minTotalItemCount
        : o.minTotalItemCount === null
          ? null
          : undefined,
    maxTotalItemCount:
      typeof o.maxTotalItemCount === "number" && Number.isInteger(o.maxTotalItemCount)
        ? o.maxTotalItemCount
        : o.maxTotalItemCount === null
          ? null
          : undefined,
    minBundleCartValue: o.minBundleCartValue as string | number | null | undefined,
    maxBundleCartValue: o.maxBundleCartValue as string | number | null | undefined,
    productHandle,
    seoTitle: typeof o.seoTitle === "string" ? o.seoTitle.trim() || null : null,
    seoDescription:
      typeof o.seoDescription === "string"
        ? o.seoDescription.trim() || null
        : null,
    storefrontDesign,
    pricingTiers,
    steps,
  };
}

export function toPrismaBundleScalars(
  shopDomain: string,
  data: BundleWritePayload,
): Omit<
  Prisma.BundleCreateInput,
  "pricingTiers" | "steps" | "id" | "bundleUid" | "createdAt" | "updatedAt"
> {
  return {
    shopDomain,
    name: data.name,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    imageGid: data.imageGid ?? null,
    productHandle: data.productHandle,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    storefrontDesign: data.storefrontDesign,
    status: data.status ?? "DRAFT",
    bundlePricingMode: data.bundlePricingMode as BundlePricingMode,
    fixedBoxItemCount: data.fixedBoxItemCount ?? null,
    pricingModeMedia: data.pricingModeMedia ?? undefined,
    pricingScope: data.pricingScope as PricingScope,
    discountValueType: data.discountValueType as DiscountValueType,
    flatDiscountValue: toDecimal(data.flatDiscountValue, "flatDiscountValue"),
    showCompareAtPrice: data.showCompareAtPrice ?? true,
    showFixedPriceOnLoad: data.showFixedPriceOnLoad ?? false,
    allowZeroTotal: data.allowZeroTotal ?? false,
    minTotalItemCount: data.minTotalItemCount ?? null,
    maxTotalItemCount: data.maxTotalItemCount ?? null,
    minBundleCartValue: toDecimal(data.minBundleCartValue, "minBundleCartValue"),
    maxBundleCartValue: toDecimal(data.maxBundleCartValue, "maxBundleCartValue"),
  };
}

export function buildNestedCreates(data: BundleWritePayload): {
  pricingTiers: Prisma.BundlePricingTierCreateWithoutBundleInput[];
  steps: Prisma.BundleStepCreateWithoutBundleInput[];
} {
  const pricingTiers = (data.pricingTiers ?? []).map((t, i) => ({
    sortOrder: t.sortOrder ?? i,
    thresholdBasis: t.thresholdBasis as ThresholdBasis,
    thresholdMin: requireDecimal(t.thresholdMin, "tier.thresholdMin"),
    thresholdMax: toDecimal(t.thresholdMax, "tier.thresholdMax"),
    tierValue: requireDecimal(t.tierValue, "tier.tierValue"),
  }));

  const steps = (data.steps ?? []).map((step, si) => ({
    sortOrder: step.sortOrder ?? si,
    name: step.name?.trim() || null,
    description: step.description ?? null,
    imageUrl: step.imageUrl ?? null,
    imageGid: step.imageGid ?? null,
    isFinalStep: step.isFinalStep ?? false,
    products: {
      create: (step.products ?? []).map((p, pi) => ({
        sortOrder: p.sortOrder ?? pi,
        variantGid: p.variantGid.trim(),
        minQuantity: p.minQuantity ?? null,
        maxQuantity: p.maxQuantity ?? null,
        productHandle:
          typeof p.productHandle === "string" && p.productHandle.trim()
            ? normalizeProductHandle(p.productHandle)
            : null,
        layoutPreset: normalizeLayoutPreset(p.layoutPreset),
        styleOverrides:
          p.styleOverrides != null && typeof p.styleOverrides === "object"
            ? (p.styleOverrides as Prisma.InputJsonValue)
            : undefined,
      })),
    },
    rules: {
      create: (step.rules ?? []).map((r, ri) => ({
        sortOrder: r.sortOrder ?? ri,
        metric: r.metric as StepRuleMetric,
        operator: r.operator as StepRuleOperator,
        value: requireDecimal(r.value, "rule.value"),
        targetVariantGid:
          r.metric === "VARIANT_QUANTITY" ? r.targetVariantGid!.trim() : null,
      })),
    },
    lineItemProperties: {
      create: (step.lineItemProperties ?? []).map((lp, li) => ({
        sortOrder: lp.sortOrder ?? li,
        fieldType: lp.fieldType as LineItemPropertyFieldType,
        label: lp.label.trim(),
        propertyKey: lp.propertyKey.trim(),
        required: lp.required ?? false,
        defaultChecked: lp.defaultChecked ?? false,
        placeholder: lp.placeholder ?? null,
      })),
    },
  }));

  return { pricingTiers, steps };
}

export function serializeBundleTree<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (value instanceof Prisma.Decimal) return value.toString();
      if (
        value &&
        typeof value === "object" &&
        value.constructor?.name === "Decimal" &&
        typeof (value as { toString?: () => string }).toString === "function"
      ) {
        return (value as { toString: () => string }).toString();
      }
      return value;
    }),
  ) as T;
}

export const bundleDetailInclude = {
  pricingTiers: { orderBy: { sortOrder: "asc" as const } },
  steps: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      products: { orderBy: { sortOrder: "asc" as const } },
      rules: { orderBy: { sortOrder: "asc" as const } },
      lineItemProperties: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} satisfies Prisma.BundleInclude;

export type BundleWithDetail = Prisma.BundleGetPayload<{
  include: typeof bundleDetailInclude;
}>;

export function bundlePrismaToWritePayload(
  bundle: BundleWithDetail,
): BundleWritePayload {
  const storefront =
    bundle.storefrontDesign != null
      ? (bundle.storefrontDesign as Prisma.InputJsonValue)
      : (defaultStorefrontDesign() as unknown as Prisma.InputJsonValue);
  return {
    name: bundle.name,
    description: bundle.description,
    imageUrl: bundle.imageUrl,
    imageGid: bundle.imageGid,
    productHandle: bundle.productHandle ?? slugifyProductHandle(bundle.name),
    seoTitle: bundle.seoTitle,
    seoDescription: bundle.seoDescription,
    storefrontDesign: storefront,
    status: bundle.status,
    bundlePricingMode: bundle.bundlePricingMode,
    fixedBoxItemCount: bundle.fixedBoxItemCount,
    pricingModeMedia:
      bundle.pricingModeMedia != null
        ? (bundle.pricingModeMedia as Prisma.InputJsonValue)
        : null,
    pricingScope: bundle.pricingScope,
    discountValueType: bundle.discountValueType,
    flatDiscountValue: bundle.flatDiscountValue?.toString() ?? null,
    showCompareAtPrice: bundle.showCompareAtPrice,
    showFixedPriceOnLoad: bundle.showFixedPriceOnLoad,
    allowZeroTotal: bundle.allowZeroTotal,
    minTotalItemCount: bundle.minTotalItemCount,
    maxTotalItemCount: bundle.maxTotalItemCount,
    minBundleCartValue: bundle.minBundleCartValue?.toString() ?? null,
    maxBundleCartValue: bundle.maxBundleCartValue?.toString() ?? null,
    pricingTiers: bundle.pricingTiers.map((t) => ({
      sortOrder: t.sortOrder,
      thresholdBasis: t.thresholdBasis,
      thresholdMin: t.thresholdMin.toString(),
      thresholdMax: t.thresholdMax?.toString() ?? null,
      tierValue: t.tierValue.toString(),
    })),
    steps: bundle.steps.map((s) => ({
      sortOrder: s.sortOrder,
      name: s.name,
      description: s.description,
      imageUrl: s.imageUrl,
      imageGid: s.imageGid,
      isFinalStep: s.isFinalStep,
      products: s.products.map((p) => ({
        variantGid: p.variantGid,
        sortOrder: p.sortOrder,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
        productHandle: p.productHandle,
        layoutPreset: p.layoutPreset,
        styleOverrides: p.styleOverrides ?? undefined,
      })),
      rules: s.rules.map((r) => ({
        sortOrder: r.sortOrder,
        metric: r.metric,
        operator: r.operator,
        value: r.value.toString(),
        targetVariantGid: r.targetVariantGid,
      })),
      lineItemProperties: s.lineItemProperties.map((lp) => ({
        sortOrder: lp.sortOrder,
        fieldType: lp.fieldType,
        label: lp.label,
        propertyKey: lp.propertyKey,
        required: lp.required,
        defaultChecked: lp.defaultChecked,
        placeholder: lp.placeholder,
      })),
    })),
  };
}

export async function duplicateBundle(
  prisma: PrismaClient,
  shopDomain: string,
  sourceId: string,
): Promise<{ id: string }> {
  const source = await prisma.bundle.findFirst({
    where: { id: sourceId, shopDomain },
    include: bundleDetailInclude,
  });
  if (!source) {
    throw new Response(JSON.stringify({ error: "Bundle introuvable" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const payload = bundlePrismaToWritePayload(source);
  payload.name = `Copie de ${source.name}`;
  payload.status = "DRAFT";
  payload.productHandle = slugifyProductHandle(`${payload.productHandle}-copie`);
  const nested = buildNestedCreates(payload);
  const scalars = toPrismaBundleScalars(shopDomain, payload);
  const created = await prisma.bundle.create({
    data: {
      ...scalars,
      shopifyProductId: null,
      shopifyParentVariantId: null,
      pricingTiers: { create: nested.pricingTiers },
      steps: { create: nested.steps },
    },
  });
  return { id: created.id };
}

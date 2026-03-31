/**
 * Schéma de l’éditeur visuel bundle (v1 + v2) — stocké en JSON (Bundle.storefrontDesign + metafield).
 * La v2 étend les blocs (hero, split, grille produits) tout en conservant les blocs v1.
 */

export const PRODUCT_LAYOUT_PRESETS = [
  {
    value: "STACK_ADD_TO_QTY",
    label: "Image, titre, puis Ajouter → quantité (0 = retrouve Ajouter)",
  },
  {
    value: "SPLIT_QTY_ADD",
    label: "Image & titre, puis quantité à gauche + Ajouter à droite",
  },
  {
    value: "ROW_COMPACT",
    label: "Ligne : image | titre & prix | contrôles",
  },
  {
    value: "MEDIA_LEFT_STACK",
    label: "Image à gauche, colonne titre + actions à droite",
  },
  {
    value: "GRID_MINIMAL",
    label: "Grille minimaliste (petite image + titre + bouton)",
  },
] as const;

export type ProductLayoutPreset = (typeof PRODUCT_LAYOUT_PRESETS)[number]["value"];

const LAYOUT_SET = new Set<string>(
  PRODUCT_LAYOUT_PRESETS.map((p) => p.value),
);

export function normalizeLayoutPreset(raw: unknown): ProductLayoutPreset {
  if (typeof raw === "string" && LAYOUT_SET.has(raw)) {
    return raw as ProductLayoutPreset;
  }
  return "STACK_ADD_TO_QTY";
}

export type TextStyleBlock = {
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  marginTop?: string;
  marginBottom?: string;
  padding?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  fontFamily?: string;
};

export type StorefrontBlock =
  | {
      id: string;
      type: "heading";
      text: string;
      tag: "h1" | "h2" | "h3";
      style: TextStyleBlock;
    }
  | {
      id: string;
      type: "text";
      text: string;
      style: TextStyleBlock;
    }
  | {
      id: string;
      type: "image";
      url: string | null;
      alt: string;
      style: TextStyleBlock & { maxWidth?: string };
    }
  | { id: string; type: "spacer"; height: number };

export type StorefrontDesignV1 = {
  version: 1;
  global: {
    pageBackground?: string;
    contentMaxWidth?: string;
    fontBody?: string;
    fontHeading?: string;
  };
  blocks: StorefrontBlock[];
};

export type HeroBlock = {
  id: string;
  type: "hero";
  headline: string;
  subtext?: string;
  imageUrl: string | null;
  layout?: "stack" | "image_left" | "image_right";
};

export type SplitBlock = {
  id: string;
  type: "split";
  title: string;
  body: string;
  imageUrl: string | null;
  imageSide: "left" | "right";
};

export type ProductGridRule = {
  metric: "BUNDLE_PRICE" | "TOTAL_ITEM_COUNT" | "VARIANT_QUANTITY" | "DISTINCT_VARIANT_COUNT";
  operator: "LT" | "LTE" | "EQ" | "GTE" | "GT";
  value: string;
  targetVariantGid?: string | null;
};

export type ProductGridBlock = {
  id: string;
  type: "product_grid";
  source: "collection" | "pick" | "all";
  collectionHandle?: string;
  /** GIDs variants pour source « pick » */
  variantGids?: string[];
  maxItems?: number;
  display: "list" | "carousel" | "tabs" | "accordion";
  rules?: ProductGridRule[];
};

export type StepBarBlock = {
  id: string;
  type: "step_bar";
  style?: {
    borderColor?: string;
    activeBg?: string;
    inactiveBg?: string;
    activeTextColor?: string;
    inactiveTextColor?: string;
  };
};

export type ProductListBlock = {
  id: string;
  type: "product_list";
};

export type StorefrontBlockV2 =
  | StorefrontBlock
  | HeroBlock
  | SplitBlock
  | ProductGridBlock
  | StepBarBlock
  | ProductListBlock;

export type StorefrontDesignV2 = {
  version: 2;
  global: StorefrontDesignV1["global"];
  blocks: StorefrontBlockV2[];
};

export type ProductStyleOverrides = {
  imageBorderRadius?: string;
  buttonBorderRadius?: string;
  buttonBackground?: string;
  buttonColor?: string;
  cardBackground?: string;
  cardBorderRadius?: string;
  titleFontSize?: string;
  priceFontSize?: string;
};

const defaultGlobal = (): StorefrontDesignV1["global"] => ({
  contentMaxWidth: "720px",
  fontBody: "system-ui, sans-serif",
  fontHeading: "system-ui, sans-serif",
  pageBackground: "transparent",
});

export function defaultStorefrontDesign(): StorefrontDesignV2 {
  return {
    version: 2,
    global: defaultGlobal(),
    blocks: [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

function normalizeProductGridRule(raw: unknown): ProductGridRule | null {
  if (!isRecord(raw)) return null;
  const metrics = [
    "BUNDLE_PRICE",
    "TOTAL_ITEM_COUNT",
    "VARIANT_QUANTITY",
    "DISTINCT_VARIANT_COUNT",
  ] as const;
  const ops = ["LT", "LTE", "EQ", "GTE", "GT"] as const;
  const m = raw.metric;
  const op = raw.operator;
  if (typeof m !== "string" || !metrics.includes(m as (typeof metrics)[number])) {
    return null;
  }
  if (typeof op !== "string" || !ops.includes(op as (typeof ops)[number])) {
    return null;
  }
  const value = typeof raw.value === "string" ? raw.value : String(raw.value ?? "");
  const targetVariantGid =
    typeof raw.targetVariantGid === "string" ? raw.targetVariantGid : null;
  return {
    metric: m as ProductGridRule["metric"],
    operator: op as ProductGridRule["operator"],
    value,
    targetVariantGid,
  };
}

function normalizeBlockV2(raw: unknown): StorefrontBlockV2 | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  const id = typeof raw.id === "string" ? raw.id : newBlockId();
  switch (raw.type) {
    case "hero": {
      return {
        id,
        type: "hero",
        headline: typeof raw.headline === "string" ? raw.headline : "Titre",
        subtext: typeof raw.subtext === "string" ? raw.subtext : undefined,
        imageUrl:
          typeof raw.imageUrl === "string" && raw.imageUrl.trim()
            ? raw.imageUrl.trim()
            : null,
        layout:
          raw.layout === "image_left" || raw.layout === "image_right"
            ? raw.layout
            : "stack",
      };
    }
    case "split": {
      return {
        id,
        type: "split",
        title: typeof raw.title === "string" ? raw.title : "",
        body: typeof raw.body === "string" ? raw.body : "",
        imageUrl:
          typeof raw.imageUrl === "string" && raw.imageUrl.trim()
            ? raw.imageUrl.trim()
            : null,
        imageSide: raw.imageSide === "right" ? "right" : "left",
      };
    }
    case "product_grid": {
      const src = raw.source;
      const source =
        src === "collection" || src === "all" || src === "pick" ? src : "pick";
      const disp = raw.display;
      const display =
        disp === "carousel" || disp === "tabs" || disp === "accordion"
          ? disp
          : "list";
      let variantGids: string[] | undefined;
      if (Array.isArray(raw.variantGids)) {
        variantGids = raw.variantGids.filter((x): x is string => typeof x === "string");
      }
      const rulesRaw = raw.rules;
      const rules = Array.isArray(rulesRaw)
        ? rulesRaw.map(normalizeProductGridRule).filter((r): r is ProductGridRule => r != null)
        : undefined;
      return {
        id,
        type: "product_grid",
        source,
        collectionHandle:
          typeof raw.collectionHandle === "string" ? raw.collectionHandle : undefined,
        variantGids,
        maxItems:
          typeof raw.maxItems === "number" && raw.maxItems > 0
            ? Math.min(50, raw.maxItems)
            : undefined,
        display,
        rules: rules?.length ? rules : undefined,
      };
    }
    case "step_bar": {
      const style = isRecord(raw.style) ? raw.style : {};
      return {
        id,
        type: "step_bar",
        style: {
          borderColor: typeof style.borderColor === "string" ? style.borderColor : undefined,
          activeBg: typeof style.activeBg === "string" ? style.activeBg : undefined,
          inactiveBg: typeof style.inactiveBg === "string" ? style.inactiveBg : undefined,
          activeTextColor: typeof style.activeTextColor === "string" ? style.activeTextColor : undefined,
          inactiveTextColor: typeof style.inactiveTextColor === "string" ? style.inactiveTextColor : undefined,
        },
      };
    }
    case "product_list": {
      return { id, type: "product_list" };
    }
    case "heading":
    case "text":
    case "image":
    case "spacer":
      return raw as StorefrontBlock;
    default:
      return null;
  }
}

/** Normalise le JSON stocké (v1 → v2, ou v2 invalide → défauts). */
export function migrateStorefrontDesign(raw: unknown): StorefrontDesignV2 {
  if (!isRecord(raw)) {
    return defaultStorefrontDesign();
  }
  const ver = raw.version;
  const globalIn = isRecord(raw.global) ? raw.global : {};
  const mergedGlobal: StorefrontDesignV1["global"] = {
    ...defaultGlobal(),
    ...globalIn,
  };
  const blocksRaw = raw.blocks;
  if (ver === 1 && Array.isArray(blocksRaw)) {
    const blocks: StorefrontBlockV2[] = [];
    for (const b of blocksRaw) {
      const n = normalizeBlockV2(b);
      if (n) blocks.push(n);
    }
    return { version: 2, global: mergedGlobal, blocks };
  }
  if (ver === 2 && Array.isArray(blocksRaw)) {
    const blocks: StorefrontBlockV2[] = [];
    for (const b of blocksRaw) {
      const n = normalizeBlockV2(b);
      if (n) blocks.push(n);
    }
    return { version: 2, global: mergedGlobal, blocks };
  }
  if (Array.isArray(blocksRaw)) {
    const blocks: StorefrontBlockV2[] = [];
    for (const b of blocksRaw) {
      const n = normalizeBlockV2(b);
      if (n) blocks.push(n);
    }
    if (blocks.length) {
      return { version: 2, global: mergedGlobal, blocks };
    }
  }
  return { version: 2, global: mergedGlobal, blocks: [] };
}

export function slugifyProductHandle(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);
  return s.length ? s : "bundle";
}

/** Handle URL Shopify : minuscules, tirets, chiffres */
export function normalizeProductHandle(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.length) return null;
  return slugifyProductHandle(t);
}

export function newBlockId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Dérive un libellé lisible pour afficher un bloc dans la sidebar. */
export function blockDisplayLabel(block: StorefrontBlockV2): string {
  switch (block.type) {
    case "heading":
      return block.text.trim().slice(0, 35) || "Titre";
    case "text":
      return block.text.trim().slice(0, 35) || "Texte";
    case "image":
      return block.alt?.trim().slice(0, 35) || "Image";
    case "spacer":
      return `Espacement (${block.height}px)`;
    case "hero":
      return block.headline.trim().slice(0, 35) || "Hero";
    case "split":
      return block.title.trim().slice(0, 35) || "Section split";
    case "product_grid":
      return block.collectionHandle?.trim().slice(0, 35) || "Grille produits";
    case "step_bar":
      return "Barre d'étape";
    case "product_list":
      return "Liste de produits";
    default:
      return "Bloc";
  }
}

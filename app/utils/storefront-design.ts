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
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  marginLeft?: string;
  marginRight?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  fontFamily?: string;
  /** Text style preset: use theme defaults for h1-h6/p, or custom values */
  textPreset?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "custom";
};

export type StorefrontBlock =
  | {
      id: string;
      name?: string;
  isHidden?: boolean;
      type: "heading";
      text: string;
      tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      style: TextStyleBlock;
    }
  | {
      id: string;
      name?: string;
  isHidden?: boolean;
      type: "text";
      text: string;
      style: TextStyleBlock;
    }
  | {
      id: string;
      name?: string;
  isHidden?: boolean;
      type: "image";
      url: string | null;
      alt: string;
      style: TextStyleBlock & { maxWidth?: string };
    }
  | { id: string; name?: string;
  isHidden?: boolean; type: "spacer"; height: number };

export type StorefrontDesignV1 = {
  version: 1;
  global: {
    pageBackground?: string;
    contentMaxWidth?: string;
    fontBody?: string;
    fontHeading?: string;
    addToBoxText?: string;
    colorPrimary?: string;
    colorBorder?: string;
    colorBackground?: string;
    colorText?: string;
    /** Section border width in px (e.g. "1") */
    borderWidth?: string;
    /** Section border radius in px (e.g. "8") */
    borderRadius?: string;
    /** Total box background color */
    totalBg?: string;
    /** Total box border color */
    totalBorderColor?: string;
    /** Total box text color */
    totalTextColor?: string;
    /** Primary nav button background (Suivant / Ajouter au panier) */
    btnPrimaryBg?: string;
    /** Primary nav button text color */
    btnPrimaryColor?: string;
    /** Primary nav button background on hover */
    btnPrimaryHoverBg?: string;
    /** Secondary nav button background (Précédent) */
    btnSecondaryBg?: string;
    /** Secondary nav button text color */
    btnSecondaryColor?: string;
    /** Secondary nav button border color */
    btnSecondaryBorderColor?: string;
  };
  blocks: StorefrontBlock[];
};

export type HeroBlock = {
  id: string;
  name?: string;
  isHidden?: boolean;
  type: "hero";
  headline: string;
  subtext?: string;
  imageUrl: string | null;
  layout?: "stack" | "image_left" | "image_right";
};

export type SplitBlock = {
  id: string;
  name?: string;
  isHidden?: boolean;
  type: "split";
  title: string;
  body: string;
  imageUrl: string | null;
  imageSide: "left" | "right";
};

export type StepBarBlock = {
  id: string;
  name?: string;
  isHidden?: boolean;
  type: "step_bar";
  preset?: "default" | "circles" | "lines" | "minimal" | "custom";
  style?: {
    borderColor?: string;
    activeBg?: string;
    inactiveBg?: string;
    activeTextColor?: string;
    inactiveTextColor?: string;
    labelColor?: string;
    completedBg?: string;
    hoverBg?: string;
    hoverTextColor?: string;
    showLine?: boolean;
    lineColor?: string;
    dotSize?: number;
    fontSize?: string;
  };
};

export type ProductListBlock = {
  id: string;
  name?: string;
  isHidden?: boolean;
  type: "product_list";
  source?: "step_pick" | "collection" | "all_products";
  collectionHandle?: string;
  /** GID of selected collection (for display) */
  collectionGid?: string;
  /** Human-readable title of selected collection */
  collectionTitle?: string;
  /** Image URL of selected collection */
  collectionImageUrl?: string;
  cardLayout?: "classic" | "overlay";
  columns?: number;
  columnsMobile?: number;
  buttonText?: string;
  buttonBackground?: string;
  buttonColor?: string;
  buttonBorderRadius?: string;
  buttonHoverBackground?: string;
  buttonHoverColor?: string;
  /** Product title color */
  titleColor?: string;
  /** Product price color (only shown in STANDARD/TIERED modes) */
  priceColor?: string;
};

export type UpsellItem = {
  id: string;
  variantGid: string;
  variantId: number;
  productTitle: string;
  priceAmount: string;
  currencyCode: string;
  defaultImageUrl?: string;
  overrideLabel?: string;
  overrideImage?: string;
  shortDescription?: string;
  defaultEnabled: boolean;
};

export type UpsellBlock = {
  id: string;
  name?: string;
  isHidden?: boolean;
  title: string;
  type: "upsell";
  behavior: "single" | "multiple";
  items: UpsellItem[];
};

export type StorefrontBlockV2 =
  | StorefrontBlock
  | HeroBlock
  | SplitBlock
  | StepBarBlock
  | ProductListBlock
  | UpsellBlock;

export type StorefrontDesignV2 = {
  version: 2;
  global: StorefrontDesignV1["global"];
  /** Global blocks (shared across all steps when no per-step design is set) */
  blocks: StorefrontBlockV2[];
  /**
   * Per-step block overrides. Key = step sortOrder (as string).
   * When a step has an entry here, these blocks are used instead of the global `blocks`.
   */
  stepDesigns?: Record<string, StorefrontBlockV2[]>;
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
      // Deprecated. Do not migrate legacy product grids to v2.
      // The permanent products block is `product_list`, driven by step settings.
      return null;
    }
    case "step_bar": {
      const style = isRecord(raw.style) ? raw.style : {};
      return {
        id,
        type: "step_bar",
        preset: typeof raw.preset === "string" ? (raw.preset as StepBarBlock["preset"]) : undefined,
        style: {
          borderColor: typeof style.borderColor === "string" ? style.borderColor : undefined,
          activeBg: typeof style.activeBg === "string" ? style.activeBg : undefined,
          inactiveBg: typeof style.inactiveBg === "string" ? style.inactiveBg : undefined,
          activeTextColor: typeof style.activeTextColor === "string" ? style.activeTextColor : undefined,
          inactiveTextColor: typeof style.inactiveTextColor === "string" ? style.inactiveTextColor : undefined,
          completedBg: typeof style.completedBg === "string" ? style.completedBg : undefined,
          hoverBg: typeof style.hoverBg === "string" ? style.hoverBg : undefined,
          hoverTextColor: typeof style.hoverTextColor === "string" ? style.hoverTextColor : undefined,
          showLine: typeof style.showLine === "boolean" ? style.showLine : undefined,
          lineColor: typeof style.lineColor === "string" ? style.lineColor : undefined,
          fontSize: typeof style.fontSize === "string" ? style.fontSize : undefined,
          labelColor: typeof style.labelColor === "string" ? style.labelColor : undefined,
        },
      };
    }
    case "product_list": {
      const src = raw.source;
      const source = src === "collection" || src === "all_products" || src === "step_pick" ? src as ProductListBlock["source"] : "step_pick";
      const handle =
        typeof raw.collectionHandle === "string" ? raw.collectionHandle.trim() : "";
      return {
        id,
        type: "product_list",
        source,
        collectionHandle: source === "collection" && handle ? handle : undefined,
        collectionGid: typeof raw.collectionGid === "string" ? raw.collectionGid : undefined,
        collectionTitle: typeof raw.collectionTitle === "string" ? raw.collectionTitle : undefined,
        collectionImageUrl: typeof raw.collectionImageUrl === "string" ? raw.collectionImageUrl : undefined,
        cardLayout: typeof raw.cardLayout === "string" ? raw.cardLayout as ProductListBlock["cardLayout"] : undefined,
        columns: typeof raw.columns === "number" ? raw.columns : undefined,
        columnsMobile: typeof raw.columnsMobile === "number" ? raw.columnsMobile : undefined,
        buttonText: typeof raw.buttonText === "string" ? raw.buttonText : undefined,
        buttonBackground: typeof raw.buttonBackground === "string" ? raw.buttonBackground : undefined,
        buttonColor: typeof raw.buttonColor === "string" ? raw.buttonColor : undefined,
        buttonBorderRadius: typeof raw.buttonBorderRadius === "string" ? raw.buttonBorderRadius : undefined,
        buttonHoverBackground: typeof raw.buttonHoverBackground === "string" ? raw.buttonHoverBackground : undefined,
        buttonHoverColor: typeof raw.buttonHoverColor === "string" ? raw.buttonHoverColor : undefined,
        titleColor: typeof raw.titleColor === "string" ? raw.titleColor : undefined,
        priceColor: typeof raw.priceColor === "string" ? raw.priceColor : undefined,
      };
    }
    case "upsell": {
      const items = Array.isArray(raw.items) ? raw.items : [];
      return {
        id,
        type: "upsell",
        title: typeof raw.title === "string" ? raw.title : "Options Supplémentaires",
        behavior: raw.behavior === "single" ? "single" : "multiple",
        items: items.map((it: unknown) => {
          if (!it || typeof it !== "object") return null;
          const o = it as Record<string, unknown>;
          return {
            id: typeof o.id === "string" ? o.id : newBlockId(),
            variantGid: typeof o.variantGid === "string" ? o.variantGid : "",
            variantId: typeof o.variantId === "number" ? o.variantId : 0,
            productTitle: typeof o.productTitle === "string" ? o.productTitle : "",
            priceAmount: typeof o.priceAmount === "string" ? o.priceAmount : "0",
            currencyCode: typeof o.currencyCode === "string" ? o.currencyCode : "",
            defaultImageUrl: typeof o.defaultImageUrl === "string" ? o.defaultImageUrl : undefined,
            overrideLabel: typeof o.overrideLabel === "string" ? o.overrideLabel : undefined,
            overrideImage: typeof o.overrideImage === "string" ? o.overrideImage : undefined,
            shortDescription: typeof o.shortDescription === "string" ? o.shortDescription : undefined,
            defaultEnabled: Boolean(o.defaultEnabled),
          } satisfies UpsellItem;
        }).filter(Boolean) as UpsellItem[],
      } satisfies UpsellBlock;
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
    // Preserve per-step designs
    const stepDesigns: Record<string, StorefrontBlockV2[]> = {};
    if (isRecord(raw.stepDesigns)) {
      for (const [key, val] of Object.entries(raw.stepDesigns)) {
        if (Array.isArray(val)) {
          const sb: StorefrontBlockV2[] = [];
          for (const b of val) {
            const n = normalizeBlockV2(b);
            if (n) sb.push(n);
          }
          stepDesigns[key] = sb;
        }
      }
    }
    return {
      version: 2,
      global: mergedGlobal,
      blocks,
      ...(Object.keys(stepDesigns).length > 0 ? { stepDesigns } : {}),
    };
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

/** Default block names by type */
export function defaultBlockName(type: StorefrontBlockV2["type"]): string {
  switch (type) {
    case "heading": return "Titre";
    case "text": return "Texte";
    case "image": return "Image";
    case "spacer": return "Espacement";
    case "hero": return "Bannière Hero";
    case "split": return "Section Split";
    case "step_bar": return "Barre d'étape";
    case "product_list": return "Liste de produits";
    case "upsell": return "Options Supplémentaires";
    default: return "Bloc";
  }
}

/** Dérive un libellé lisible pour afficher un bloc dans la sidebar. */
export function blockDisplayLabel(block: StorefrontBlockV2): string {
  // Prefer user-set name
  const n = (block as { name?: string }).name?.trim();
  if (n) return n;
  return defaultBlockName(block.type);
}

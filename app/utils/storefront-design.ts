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
      type: "heading";
      text: string;
      tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      style: TextStyleBlock;
    }
  | {
      id: string;
      name?: string;
      type: "text";
      text: string;
      style: TextStyleBlock;
    }
  | {
      id: string;
      name?: string;
      type: "image";
      url: string | null;
      alt: string;
      style: TextStyleBlock & { maxWidth?: string };
    }
  | { id: string; name?: string; type: "spacer"; height: number };

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
  };
  blocks: StorefrontBlock[];
};

export type HeroBlock = {
  id: string;
  name?: string;
  type: "hero";
  headline: string;
  subtext?: string;
  imageUrl: string | null;
  layout?: "stack" | "image_left" | "image_right";
};

export type SplitBlock = {
  id: string;
  name?: string;
  type: "split";
  title: string;
  body: string;
  imageUrl: string | null;
  imageSide: "left" | "right";
};

export type StepBarBlock = {
  id: string;
  name?: string;
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
  type: "product_list";
  source?: "step_pick" | "collection" | "all_products";
  collectionHandle?: string;
  cardLayout?: "classic" | "overlay";
  columns?: number;
  columnsMobile?: number;
  buttonText?: string;
  buttonBackground?: string;
  buttonColor?: string;
  buttonBorderRadius?: string;
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
      const src = raw.source;
      const source = src === "collection" || src === "step_pick" ? src : "step_pick";
      const handle =
        typeof raw.collectionHandle === "string" ? raw.collectionHandle.trim() : "";
      return {
        id,
        type: "product_list",
        source,
        collectionHandle: source === "collection" && handle ? handle : undefined,
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

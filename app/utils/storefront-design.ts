/**
 * Schéma de l’éditeur visuel bundle (v1) — stocké en JSON (Bundle.storefrontDesign + metafield).
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

export function defaultStorefrontDesign(): StorefrontDesignV1 {
  return {
    version: 1,
    global: {
      contentMaxWidth: "720px",
      fontBody: "system-ui, sans-serif",
      fontHeading: "system-ui, sans-serif",
      pageBackground: "transparent",
    },
    blocks: [],
  };
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

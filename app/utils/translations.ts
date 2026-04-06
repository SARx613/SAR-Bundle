/**
 * SAR Bundle — Translation Dictionaries & Utilities
 * ═══════════════════════════════════════════════════
 * Default translations for all static UI text in the bundle storefront.
 * The merchant can override any key via the "Textes & Langues" admin page.
 */

export interface TranslationDictionary {
  [key: string]: string;
}

/** All supported translation keys with their context description */
export const TRANSLATION_KEYS: {
  key: string;
  context: string;
  contextFr: string;
}[] = [
  {
    key: "btn_add_to_cart",
    context: "Final checkout button",
    contextFr: "Bouton d'ajout au panier (final)",
  },
  {
    key: "btn_next",
    context: "Next step button",
    contextFr: "Bouton étape suivante",
  },
  {
    key: "btn_previous",
    context: "Previous step button",
    contextFr: "Bouton étape précédente",
  },
  {
    key: "label_total",
    context: "Bundle total label",
    contextFr: "Libellé du total du pack",
  },
  {
    key: "btn_add_to_box",
    context: "Add product to bundle button",
    contextFr: "Bouton d'ajout d'un produit au pack",
  },
  {
    key: "label_step",
    context: "Step label prefix",
    contextFr: "Préfixe de l'étape (ex: Étape 1)",
  },
  {
    key: "label_loading",
    context: "Loading message",
    contextFr: "Message de chargement",
  },
  {
    key: "label_select_product",
    context: "Error: no product selected",
    contextFr: "Erreur : aucun produit sélectionné",
  },
  {
    key: "label_upsell_title",
    context: "Upsell section title",
    contextFr: "Titre de la section upsell",
  },
  {
    key: "label_composition",
    context: "Cart composition label",
    contextFr: "Libellé composition dans le panier",
  },
  {
    key: "label_heading_default",
    context: "Default bundle heading",
    contextFr: "Titre par défaut du bundle",
  },
];

/** Built-in fallback dictionaries (EN, FR, ES) */
export const DEFAULT_TRANSLATIONS: Record<string, TranslationDictionary> = {
  en: {
    btn_add_to_cart: "Add to cart",
    btn_next: "Next",
    btn_previous: "Previous",
    label_total: "Bundle total",
    btn_add_to_box: "Add to box",
    label_step: "Step",
    label_loading: "Loading bundle…",
    label_select_product: "Select at least one product.",
    label_upsell_title: "Extra Options",
    label_composition: "Bundle composition",
    label_heading_default: "Build your bundle",
  },
  fr: {
    btn_add_to_cart: "Ajouter au panier",
    btn_next: "Suivant",
    btn_previous: "Précédent",
    label_total: "Total du pack",
    btn_add_to_box: "Ajouter",
    label_step: "Étape",
    label_loading: "Chargement du bundle…",
    label_select_product: "Sélectionnez au moins un produit.",
    label_upsell_title: "Options Supplémentaires",
    label_composition: "Composition du pack",
    label_heading_default: "Composez votre pack",
  },
  es: {
    btn_add_to_cart: "Añadir al carrito",
    btn_next: "Siguiente",
    btn_previous: "Anterior",
    label_total: "Total del pack",
    btn_add_to_box: "Añadir",
    label_step: "Paso",
    label_loading: "Cargando el paquete…",
    label_select_product: "Seleccione al menos un producto.",
    label_upsell_title: "Opciones Adicionales",
    label_composition: "Composición del pack",
    label_heading_default: "Arma tu pack",
  },
};

/**
 * Detect language code from shop locale string.
 * Shopify locales look like "en", "fr", "es", "pt-BR", etc.
 */
export function detectLanguageFromLocale(locale: string | null | undefined): string {
  if (!locale) return "en";
  const lang = locale.split("-")[0].split("_")[0].toLowerCase().trim();
  if (lang in DEFAULT_TRANSLATIONS) return lang;
  return "en";
}

/**
 * Merge default translations with merchant overrides.
 * Priority: merchant override > shop language default > English fallback
 */
export function buildTranslations(
  shopLocale: string | null | undefined,
  overrides: { key: string; value: string }[],
): TranslationDictionary {
  const lang = detectLanguageFromLocale(shopLocale);
  const base = { ...DEFAULT_TRANSLATIONS.en };

  // Layer the shop language defaults
  if (lang !== "en" && DEFAULT_TRANSLATIONS[lang]) {
    Object.assign(base, DEFAULT_TRANSLATIONS[lang]);
  }

  // Layer merchant overrides
  for (const ov of overrides) {
    if (ov.key && ov.value && ov.value.trim()) {
      base[ov.key] = ov.value.trim();
    }
  }

  return base;
}

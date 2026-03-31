import {
  BlockStack,
  Box,
  Button,
  InlineStack,
  Select,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
import { ArrowLeftIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  type HeroBlock,
  type StepBarBlock,
  type StorefrontBlockV2,
  type StorefrontDesignV2,
  type TextStyleBlock,
} from "../../utils/storefront-design";
import { blockDisplayLabel } from "../../utils/storefront-design";
import type { UiStep } from "../../utils/bundle-form.client";

const HEADING_TAGS = [
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
] as const;

const CSS_VAR_HINT = "Laisser vide = valeur du thème. Ex. : var(--p-color-text)";

function StyleFields({
  style,
  onChange,
}: {
  style: TextStyleBlock;
  onChange: (s: TextStyleBlock) => void;
}) {
  return (
    <BlockStack gap="200">
      <TextField
        label="Taille police"
        value={style.fontSize ?? ""}
        onChange={(v) => onChange({ ...style, fontSize: v || undefined })}
        autoComplete="off"
        helpText="ex. 1.25rem, 18px — ou laisser vide (var(--p-font-size-300))"
      />
      <TextField
        label="Couleur"
        value={style.color ?? ""}
        onChange={(v) => onChange({ ...style, color: v || undefined })}
        autoComplete="off"
        helpText={CSS_VAR_HINT + " — var(--p-color-text)"}
      />
      <TextField
        label="Fond"
        value={style.backgroundColor ?? ""}
        onChange={(v) => onChange({ ...style, backgroundColor: v || undefined })}
        autoComplete="off"
        helpText={CSS_VAR_HINT + " — var(--p-color-bg-surface)"}
      />
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
      <TextField
        label="Marge haut"
        value={style.marginTop ?? ""}
        onChange={(v) => onChange({ ...style, marginTop: v || undefined })}
        autoComplete="off"
        helpText="ex. 0.75rem, 12px"
      />
      <TextField
        label="Marge bas"
        value={style.marginBottom ?? ""}
        onChange={(v) => onChange({ ...style, marginBottom: v || undefined })}
        autoComplete="off"
        helpText="ex. 0.5rem, 8px"
      />
      <TextField
        label="Padding"
        value={style.padding ?? ""}
        onChange={(v) => onChange({ ...style, padding: v || undefined })}
        autoComplete="off"
        helpText="ex. 0.5rem 1rem"
      />
      <TextField
        label="Rayon bordure"
        value={style.borderRadius ?? ""}
        onChange={(v) => onChange({ ...style, borderRadius: v || undefined })}
        autoComplete="off"
        helpText={CSS_VAR_HINT + " — var(--p-border-radius-200)"}
      />
      <TextField
        label="Bordure (épaisseur)"
        value={style.borderWidth ?? ""}
        onChange={(v) => onChange({ ...style, borderWidth: v || undefined })}
        autoComplete="off"
        helpText="ex. 1px — var(--p-border-width-025)"
      />
      <TextField
        label="Couleur bordure"
        value={style.borderColor ?? ""}
        onChange={(v) => onChange({ ...style, borderColor: v || undefined })}
        autoComplete="off"
        helpText={CSS_VAR_HINT + " — var(--p-color-border)"}
      />
      <TextField
        label="Police (CSS)"
        value={style.fontFamily ?? ""}
        onChange={(v) => onChange({ ...style, fontFamily: v || undefined })}
        autoComplete="off"
        helpText="ex. system-ui, Georgia — ou laisser vide"
      />
      <TextField
        label="Graisse"
        value={style.fontWeight ?? ""}
        onChange={(v) => onChange({ ...style, fontWeight: v || undefined })}
        autoComplete="off"
        helpText="ex. 400, 600, bold"
      />
    </BlockStack>
  );
}

function StepBarStyleFields({
  block,
  onPatch,
}: {
  block: StepBarBlock;
  onPatch: (patch: Partial<StepBarBlock>) => void;
}) {
  const style = block.style ?? {};
  const patchStyle = (s: Partial<StepBarBlock["style"]>) =>
    onPatch({ style: { ...style, ...s } });

  return (
    <BlockStack gap="200">
      <TextField
        label="Couleur bordure / lignes"
        value={style.borderColor ?? ""}
        onChange={(v) => patchStyle({ borderColor: v || undefined })}
        autoComplete="off"
        helpText="var(--p-color-border)"
      />
      <TextField
        label="Fond étape active"
        value={style.activeBg ?? ""}
        onChange={(v) => patchStyle({ activeBg: v || undefined })}
        autoComplete="off"
        helpText="var(--p-color-bg-fill-brand)"
      />
      <TextField
        label="Fond étape inactive"
        value={style.inactiveBg ?? ""}
        onChange={(v) => patchStyle({ inactiveBg: v || undefined })}
        autoComplete="off"
        helpText="var(--p-color-bg-fill-secondary)"
      />
      <TextField
        label="Couleur texte (active)"
        value={style.activeTextColor ?? ""}
        onChange={(v) => patchStyle({ activeTextColor: v || undefined })}
        autoComplete="off"
        helpText="var(--p-color-text-on-color)"
      />
      <TextField
        label="Couleur texte (inactive)"
        value={style.inactiveTextColor ?? ""}
        onChange={(v) => patchStyle({ inactiveTextColor: v || undefined })}
        autoComplete="off"
        helpText="var(--p-color-text)"
      />
    </BlockStack>
  );
}

function BlockGeneralFields({
  block,
  step,
  onPatch,
  onGoToSettings,
}: {
  block: StorefrontBlockV2;
  step: UiStep | undefined;
  onPatch: (patch: Partial<StorefrontBlockV2>) => void;
  onGoToSettings: () => void;
}) {
  const shopifyBridge = useAppBridge();
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
          onChange={(v) => onPatch({ tag: v as "h1" | "h2" | "h3" })}
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
    const source = block.source ?? "step_pick";
    const count = step?.products.length ?? 0;
    return (
      <BlockStack gap="300">
        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
          <Text as="p" variant="bodySm">
            {source === "collection"
              ? `Collection : ${block.collectionHandle || "—"}`
              : `${count} produit(s) assigné(s) à cette étape.`}
          </Text>
        </Box>
        <Select
          label="Source des produits éligibles"
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
                const sel = (selected as { selection?: Array<{ handle?: string; title?: string; id?: string }> } | null)
                  ?.selection?.[0];
                const handle = sel?.handle;
                if (handle) {
                  onPatch({ collectionHandle: String(handle) } as Partial<StorefrontBlockV2>);
                }
              }}
            >
              Sélectionner une collection (Shopify)
            </Button>
          </BlockStack>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            Ce bloc affiche automatiquement les produits éligibles de l'étape courante.
            Pour ajouter ou retirer des produits, gérez-les dans l'onglet Paramètres.
          </Text>
        )}
        <Text as="p" variant="bodySm" tone="subdued">
          Sur la boutique, les titres et images sont récupérés via Shopify (handle/variants) pour éviter « Default Title ».
        </Text>
        <Button variant="plain" onClick={onGoToSettings}>
          Gérer les produits →
        </Button>
      </BlockStack>
    );
  }
  if (block.type === "step_bar") {
    return (
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          La barre d'étape affiche la progression du bundle. Configurez les couleurs dans l'onglet Style.
        </Text>
      </BlockStack>
    );
  }
  return null;
}

export function SidebarLevel3({
  blockId,
  stepName,
  stepIndex,
  step,
  design,
  onDesignChange,
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
      <BlockGeneralFields
        block={block}
        step={step}
        onPatch={patchBlock}
        onGoToSettings={onGoToSettings}
      />
      <Button
        tone="critical"
        variant="plain"
        onClick={() => onDeleteBlock(blockId)}
      >
        Supprimer ce bloc
      </Button>
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


/**
 * Conservé pour compatibilité avec les tests ou usages futurs.
 * La logique d'édition bloc par bloc est maintenant dans SidebarLevel3.
 * Ce fichier gère les styles globaux et les boutons d'ajout de blocs.
 */
import { useMemo, type ReactNode } from "react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { DragHandleIcon } from "@shopify/polaris-icons";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  newBlockId,
  type HeroBlock,
  type ProductGridBlock,
  type ProductGridRule,
  type StorefrontBlockV2,
  type StorefrontDesignV2,
  type TextStyleBlock,
} from "../../utils/storefront-design";

const HEADING_TAGS = [
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
] as const;

const GRID_RULE_METRICS: { label: string; value: ProductGridRule["metric"] }[] =
  [
    { label: "Prix du bundle", value: "BUNDLE_PRICE" },
    { label: "Nombre total d'articles", value: "TOTAL_ITEM_COUNT" },
    { label: "Quantité d'un variant", value: "VARIANT_QUANTITY" },
    {
      label: "Nombre de variants distincts",
      value: "DISTINCT_VARIANT_COUNT",
    },
  ];

const GRID_RULE_OPS: { label: string; value: ProductGridRule["operator"] }[] = [
  { label: "<", value: "LT" },
  { label: "≤", value: "LTE" },
  { label: "=", value: "EQ" },
  { label: "≥", value: "GTE" },
  { label: ">", value: "GT" },
];

export const emptyTextStyle = (): TextStyleBlock => ({
  fontSize: "1rem",
  color: "var(--p-color-text)",
  marginBottom: "0.5rem",
});

export function blockTypeLabel(t: string): string {
  const m: Record<string, string> = {
    heading: "titre",
    text: "texte",
    image: "image",
    spacer: "espacement",
    hero: "hero",
    split: "split",
    product_grid: "grille produits",
  };
  return m[t] ?? t;
}

export function StyleFields({
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
        helpText="ex. 1.25rem, 18px"
      />
      <TextField
        label="Couleur"
        value={style.color ?? ""}
        onChange={(v) => onChange({ ...style, color: v || undefined })}
        autoComplete="off"
        helpText="Laisser vide = var(--p-color-text)"
      />
      <TextField
        label="Fond"
        value={style.backgroundColor ?? ""}
        onChange={(v) =>
          onChange({ ...style, backgroundColor: v || undefined })
        }
        autoComplete="off"
        helpText="Laisser vide = var(--p-color-bg-surface)"
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
          onChange({
            ...style,
            textAlign: v as TextStyleBlock["textAlign"],
          })
        }
      />
      <TextField
        label="Marge haut"
        value={style.marginTop ?? ""}
        onChange={(v) => onChange({ ...style, marginTop: v || undefined })}
        autoComplete="off"
      />
      <TextField
        label="Marge bas"
        value={style.marginBottom ?? ""}
        onChange={(v) => onChange({ ...style, marginBottom: v || undefined })}
        autoComplete="off"
      />
      <TextField
        label="Padding"
        value={style.padding ?? ""}
        onChange={(v) => onChange({ ...style, padding: v || undefined })}
        autoComplete="off"
      />
      <TextField
        label="Rayon bordure"
        value={style.borderRadius ?? ""}
        onChange={(v) => onChange({ ...style, borderRadius: v || undefined })}
        autoComplete="off"
        helpText="Laisser vide = var(--p-border-radius-200)"
      />
      <TextField
        label="Bordure (épaisseur)"
        value={style.borderWidth ?? ""}
        onChange={(v) => onChange({ ...style, borderWidth: v || undefined })}
        autoComplete="off"
      />
      <TextField
        label="Couleur bordure"
        value={style.borderColor ?? ""}
        onChange={(v) => onChange({ ...style, borderColor: v || undefined })}
        autoComplete="off"
        helpText="Laisser vide = var(--p-color-border)"
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
      />
    </BlockStack>
  );
}

function SortableBlockShell({
  id,
  children,
}: {
  id: string;
  children: (drag: {
    attributes: Record<string, unknown>;
    listeners: Record<string, unknown>;
  }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.88 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

export function BundleStorefrontBlocksEditor({
  design,
  onChange,
}: {
  design: StorefrontDesignV2;
  onChange: (next: StorefrontDesignV2) => void;
}) {
  const setBlocks = (blocks: StorefrontBlockV2[]) =>
    onChange({ ...design, version: 2, blocks });

  const patchBlock = (id: string, patch: Partial<StorefrontBlockV2>) => {
    setBlocks(
      design.blocks.map((b) =>
        b.id === id ? ({ ...b, ...patch } as StorefrontBlockV2) : b,
      ),
    );
  };

  const addHeading = () => {
    const id = newBlockId();
    setBlocks([
      ...design.blocks,
      {
        id,
        type: "heading",
        text: "Titre",
        tag: "h2",
        style: emptyTextStyle(),
      },
    ]);
  };

  const addText = () => {
    const id = newBlockId();
    setBlocks([
      ...design.blocks,
      {
        id,
        type: "text",
        text: "Paragraphe de texte. Décrivez votre offre ici.",
        style: { ...emptyTextStyle(), fontSize: "0.95rem" },
      },
    ]);
  };

  const addImage = () => {
    const id = newBlockId();
    setBlocks([
      ...design.blocks,
      {
        id,
        type: "image",
        url: null,
        alt: "",
        style: { ...emptyTextStyle(), maxWidth: "100%" },
      },
    ]);
  };

  const addSpacer = () => {
    setBlocks([
      ...design.blocks,
      { id: newBlockId(), type: "spacer", height: 16 },
    ]);
  };

  const addHero = () => {
    setBlocks([
      ...design.blocks,
      {
        id: newBlockId(),
        type: "hero",
        headline: "Titre hero",
        subtext: "",
        imageUrl: null,
        layout: "stack",
      },
    ]);
  };

  const addSplit = () => {
    setBlocks([
      ...design.blocks,
      {
        id: newBlockId(),
        type: "split",
        title: "Titre",
        body: "Texte à côté de l'image.",
        imageUrl: null,
        imageSide: "left",
      },
    ]);
  };

  const addProductGrid = () => {
    const b: ProductGridBlock = {
      id: newBlockId(),
      type: "product_grid",
      source: "pick",
      display: "list",
      variantGids: [],
      rules: [],
    };
    setBlocks([...design.blocks, b]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const blockIds = useMemo(
    () => design.blocks.map((b) => b.id),
    [design.blocks],
  );

  const onBlocksDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blockIds.indexOf(String(active.id));
    const newIndex = blockIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setBlocks(arrayMove(design.blocks, oldIndex, newIndex));
  };

  const patchProductGrid = (id: string, patch: Partial<ProductGridBlock>) => {
    setBlocks(
      design.blocks.map((b) =>
        b.id === id && b.type === "product_grid"
          ? ({ ...b, ...patch } as ProductGridBlock)
          : b,
      ),
    );
  };

  const renderBlockFields = (block: StorefrontBlockV2) => {
    if (block.type === "heading") {
      return (
        <>
          <TextField
            label="Texte"
            value={block.text}
            onChange={(v) => patchBlock(block.id, { text: v })}
            autoComplete="off"
          />
          <Select
            label="Balise SEO"
            options={[...HEADING_TAGS]}
            value={block.tag}
            onChange={(v) =>
              patchBlock(block.id, {
                tag: v as "h1" | "h2" | "h3",
              })
            }
          />
          <StyleFields
            style={block.style}
            onChange={(s) => patchBlock(block.id, { style: s })}
          />
        </>
      );
    }
    if (block.type === "text") {
      return (
        <>
          <TextField
            label="Contenu"
            value={block.text}
            onChange={(v) => patchBlock(block.id, { text: v })}
            multiline={4}
            autoComplete="off"
          />
          <StyleFields
            style={block.style}
            onChange={(s) => patchBlock(block.id, { style: s })}
          />
        </>
      );
    }
    if (block.type === "image") {
      return (
        <>
          <TextField
            label="URL image (https)"
            value={block.url ?? ""}
            onChange={(v) =>
              patchBlock(block.id, { url: v.trim() || null })
            }
            autoComplete="off"
          />
          <TextField
            label="Texte alternatif (alt)"
            value={block.alt}
            onChange={(v) => patchBlock(block.id, { alt: v })}
            autoComplete="off"
          />
          <TextField
            label="Largeur max"
            value={block.style.maxWidth ?? ""}
            onChange={(v) =>
              patchBlock(block.id, {
                style: {
                  ...block.style,
                  maxWidth: v || undefined,
                },
              })
            }
            autoComplete="off"
          />
          <StyleFields
            style={block.style}
            onChange={(s) => patchBlock(block.id, { style: s })}
          />
        </>
      );
    }
    if (block.type === "spacer") {
      return (
        <TextField
          label="Hauteur (px)"
          value={String(block.height)}
          onChange={(v) =>
            patchBlock(block.id, {
              height: Math.max(0, parseInt(v, 10) || 0),
            })
          }
          autoComplete="off"
        />
      );
    }
    if (block.type === "hero") {
      return (
        <>
          <TextField
            label="Titre"
            value={block.headline}
            onChange={(v) => patchBlock(block.id, { headline: v })}
            autoComplete="off"
          />
          <TextField
            label="Sous-texte"
            value={block.subtext ?? ""}
            onChange={(v) => patchBlock(block.id, { subtext: v || undefined })}
            multiline={2}
            autoComplete="off"
          />
          <TextField
            label="URL image"
            value={block.imageUrl ?? ""}
            onChange={(v) =>
              patchBlock(block.id, { imageUrl: v.trim() || null })
            }
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
            onChange={(v) =>
              patchBlock(block.id, {
                layout: v as HeroBlock["layout"],
              })
            }
          />
        </>
      );
    }
    if (block.type === "split") {
      return (
        <>
          <TextField
            label="Titre"
            value={block.title}
            onChange={(v) => patchBlock(block.id, { title: v })}
            autoComplete="off"
          />
          <TextField
            label="Texte"
            value={block.body}
            onChange={(v) => patchBlock(block.id, { body: v })}
            multiline={4}
            autoComplete="off"
          />
          <TextField
            label="URL image"
            value={block.imageUrl ?? ""}
            onChange={(v) =>
              patchBlock(block.id, { imageUrl: v.trim() || null })
            }
            autoComplete="off"
          />
          <Select
            label="Côté image"
            options={[
              { label: "Gauche", value: "left" },
              { label: "Droite", value: "right" },
            ]}
            value={block.imageSide}
            onChange={(v) =>
              patchBlock(block.id, {
                imageSide: v as "left" | "right",
              })
            }
          />
        </>
      );
    }
    if (block.type === "product_grid") {
      const rules = block.rules ?? [];
      return (
        <>
          <Select
            label="Source des produits"
            options={[
              { label: "Sélection manuelle (GIDs)", value: "pick" },
              { label: "Collection (handle)", value: "collection" },
              { label: "Tout le catalogue", value: "all" },
            ]}
            value={block.source}
            onChange={(v) =>
              patchProductGrid(block.id, {
                source: v as ProductGridBlock["source"],
              })
            }
          />
          {block.source === "collection" ? (
            <TextField
              label="Handle collection"
              value={block.collectionHandle ?? ""}
              onChange={(v) =>
                patchProductGrid(block.id, {
                  collectionHandle: v.trim() || undefined,
                })
              }
              autoComplete="off"
            />
          ) : null}
          {block.source === "pick" ? (
            <TextField
              label="Variants (GIDs, un par ligne)"
              value={(block.variantGids ?? []).join("\n")}
              onChange={(v) =>
                patchProductGrid(block.id, {
                  variantGids: v
                    .split(/[\n,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              multiline={4}
              autoComplete="off"
            />
          ) : null}
          <TextField
            label="Nombre max d'articles (optionnel)"
            value={block.maxItems != null ? String(block.maxItems) : ""}
            onChange={(v) => {
              const t = v.trim();
              patchProductGrid(block.id, {
                maxItems: t ? Math.min(50, parseInt(t, 10) || 0) : undefined,
              });
            }}
            autoComplete="off"
          />
          <Select
            label="Présentation"
            options={[
              { label: "Liste", value: "list" },
              { label: "Carrousel", value: "carousel" },
              { label: "Onglets", value: "tabs" },
              { label: "Accordéon", value: "accordion" },
            ]}
            value={block.display}
            onChange={(v) =>
              patchProductGrid(block.id, {
                display: v as ProductGridBlock["display"],
              })
            }
          />
          <Text as="h4" variant="headingSm">
            Règles d'affichage du bloc
          </Text>
          {rules.map((r, ri) => (
            <Box
              key={ri}
              padding="300"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="200">
                <Select
                  label="Métrique"
                  options={GRID_RULE_METRICS}
                  value={r.metric}
                  onChange={(v) => {
                    const next = [...rules];
                    const cur = next[ri];
                    if (cur)
                      next[ri] = {
                        ...cur,
                        metric: v as ProductGridRule["metric"],
                      };
                    patchProductGrid(block.id, { rules: next });
                  }}
                />
                <Select
                  label="Opérateur"
                  options={GRID_RULE_OPS}
                  value={r.operator}
                  onChange={(v) => {
                    const next = [...rules];
                    const cur = next[ri];
                    if (cur)
                      next[ri] = {
                        ...cur,
                        operator: v as ProductGridRule["operator"],
                      };
                    patchProductGrid(block.id, { rules: next });
                  }}
                />
                <TextField
                  label="Valeur"
                  value={r.value}
                  onChange={(v) => {
                    const next = [...rules];
                    const cur = next[ri];
                    if (cur) next[ri] = { ...cur, value: v };
                    patchProductGrid(block.id, { rules: next });
                  }}
                  autoComplete="off"
                />
                {r.metric === "VARIANT_QUANTITY" ? (
                  <TextField
                    label="Variant (GID cible)"
                    value={r.targetVariantGid ?? ""}
                    onChange={(v) => {
                      const next = [...rules];
                      const cur = next[ri];
                      if (cur)
                        next[ri] = {
                          ...cur,
                          targetVariantGid: v.trim() || null,
                        };
                      patchProductGrid(block.id, { rules: next });
                    }}
                    autoComplete="off"
                  />
                ) : null}
                <Button
                  tone="critical"
                  variant="plain"
                  onClick={() =>
                    patchProductGrid(block.id, {
                      rules: rules.filter((_, j) => j !== ri),
                    })
                  }
                >
                  Supprimer la règle
                </Button>
              </BlockStack>
            </Box>
          ))}
          <Button
            onClick={() =>
              patchProductGrid(block.id, {
                rules: [
                  ...rules,
                  {
                    metric: "BUNDLE_PRICE",
                    operator: "GTE",
                    value: "0",
                    targetVariantGid: null,
                  },
                ],
              })
            }
          >
            + Règle
          </Button>
        </>
      );
    }
    return null;
  };

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            Styles globaux
          </Text>
          <TextField
            label="Largeur max du contenu"
            value={design.global.contentMaxWidth ?? ""}
            onChange={(v) =>
              onChange({
                ...design,
                version: 2,
                global: { ...design.global, contentMaxWidth: v || undefined },
              })
            }
            autoComplete="off"
          />
          <TextField
            label="Fond de page (section bundle)"
            value={design.global.pageBackground ?? ""}
            onChange={(v) =>
              onChange({
                ...design,
                version: 2,
                global: { ...design.global, pageBackground: v || undefined },
              })
            }
            autoComplete="off"
          />
          <TextField
            label="Police titres (CSS)"
            value={design.global.fontHeading ?? ""}
            onChange={(v) =>
              onChange({
                ...design,
                version: 2,
                global: { ...design.global, fontHeading: v || undefined },
              })
            }
            autoComplete="off"
          />
          <TextField
            label="Police corps (CSS)"
            value={design.global.fontBody ?? ""}
            onChange={(v) =>
              onChange({
                ...design,
                version: 2,
                global: { ...design.global, fontBody: v || undefined },
              })
            }
            autoComplete="off"
          />
        </BlockStack>
      </Card>

      <InlineStack gap="200" wrap>
        <Button onClick={addHeading}>+ Titre</Button>
        <Button onClick={addText}>+ Texte</Button>
        <Button onClick={addImage}>+ Image</Button>
        <Button onClick={addSpacer}>+ Espacement</Button>
        <Button onClick={addHero}>+ Hero</Button>
        <Button onClick={addSplit}>+ Split</Button>
        <Button onClick={addProductGrid}>+ Grille produits</Button>
      </InlineStack>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onBlocksDragEnd}
      >
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          <BlockStack gap="300">
            {design.blocks.map((block, idx) => (
              <SortableBlockShell key={block.id} id={block.id}>
                {({ attributes, listeners }) => (
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <button
                            type="button"
                            aria-label="Glisser le bloc"
                            style={{
                              cursor: "grab",
                              border: "none",
                              background: "transparent",
                              padding: 4,
                              display: "flex",
                            }}
                            {...attributes}
                            {...listeners}
                          >
                            <Icon source={DragHandleIcon} tone="subdued" />
                          </button>
                          <Text as="h4" variant="headingSm">
                            Bloc {idx + 1} ({blockTypeLabel(block.type)})
                          </Text>
                        </InlineStack>
                        <Button
                          tone="critical"
                          variant="plain"
                          onClick={() =>
                            setBlocks(
                              design.blocks.filter((b) => b.id !== block.id),
                            )
                          }
                        >
                          Supprimer
                        </Button>
                      </InlineStack>
                      {renderBlockFields(block)}
                    </BlockStack>
                  </Card>
                )}
              </SortableBlockShell>
            ))}
          </BlockStack>
        </SortableContext>
      </DndContext>

      {design.blocks.length === 0 ? (
        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Aucun bloc pour l'instant. Les étapes et produits s'affichent en
            dessous sur la boutique. Ajoutez des blocs pour personnaliser la
            zone au-dessus du tunnel.
          </Text>
        </Box>
      ) : null}
    </BlockStack>
  );
}

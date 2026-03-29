import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text,
  TextField,
  Box,
} from "@shopify/polaris";
import {
  newBlockId,
  type StorefrontBlock,
  type StorefrontDesignV1,
  type TextStyleBlock,
} from "../../utils/storefront-design";

const HEADING_TAGS = [
  { label: "H1", value: "h1" },
  { label: "H2", value: "h2" },
  { label: "H3", value: "h3" },
] as const;

const emptyTextStyle = (): TextStyleBlock => ({
  fontSize: "1rem",
  color: "#121212",
  marginBottom: "0.5rem",
});

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
        helpText="ex. 1.25rem, 18px"
      />
      <TextField
        label="Couleur"
        value={style.color ?? ""}
        onChange={(v) => onChange({ ...style, color: v || undefined })}
        autoComplete="off"
      />
      <TextField
        label="Fond"
        value={style.backgroundColor ?? ""}
        onChange={(v) =>
          onChange({ ...style, backgroundColor: v || undefined })
        }
        autoComplete="off"
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

export function BundleStorefrontBlocksEditor({
  design,
  onChange,
}: {
  design: StorefrontDesignV1;
  onChange: (next: StorefrontDesignV1) => void;
}) {
  const setBlocks = (blocks: StorefrontBlock[]) =>
    onChange({ ...design, blocks });

  const patchBlock = (id: string, patch: Partial<StorefrontBlock>) => {
    setBlocks(
      design.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as StorefrontBlock) : b)),
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
      </InlineStack>

      {design.blocks.map((block, idx) => (
        <Card key={block.id}>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h4" variant="headingSm">
                Bloc {idx + 1}{" "}
                {block.type === "heading"
                  ? "(titre)"
                  : block.type === "text"
                    ? "(texte)"
                    : block.type === "image"
                      ? "(image)"
                      : "(espacement)"}
              </Text>
              <Button
                tone="critical"
                variant="plain"
                onClick={() =>
                  setBlocks(design.blocks.filter((b) => b.id !== block.id))
                }
              >
                Supprimer
              </Button>
            </InlineStack>

            {block.type === "heading" ? (
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
            ) : null}

            {block.type === "text" ? (
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
            ) : null}

            {block.type === "image" ? (
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
            ) : null}

            {block.type === "spacer" ? (
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
            ) : null}
          </BlockStack>
        </Card>
      ))}

      {design.blocks.length === 0 ? (
        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Aucun bloc pour l’instant. Les étapes et produits s’affichent en
            dessous sur la boutique. Ajoutez titres, textes et images pour
            personnaliser la page au-dessus du tunnel.
          </Text>
        </Box>
      ) : null}
    </BlockStack>
  );
}

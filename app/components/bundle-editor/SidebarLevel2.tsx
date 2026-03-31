import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  BlockStack,
  Box,
  Button,
  Checkbox,
  Collapsible,
  Divider,
  DropZone,
  Icon,
  InlineStack,
  Modal,
  Select,
  Tabs,
  Text,
  TextField,
  Thumbnail,
  Tooltip,
} from "@shopify/polaris";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DeleteIcon,
  DragHandleIcon,
  SettingsIcon,
  SearchIcon,
} from "@shopify/polaris-icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  blockDisplayLabel,
  newBlockId,
  type StorefrontBlockV2,
  type StorefrontDesignV2,
} from "../../utils/storefront-design";
import type { UiStep, UiStepProduct, UiStepRule } from "../../utils/bundle-form.client";

type UploadJson = {
  ok?: boolean;
  error?: string;
  imageUrl?: string | null;
  imageGid?: string | null;
};

type PickerVariant = {
  id: string;
  displayName?: string;
  image?: { url?: string | null } | null;
  product?: { handle?: string | null };
};

function variantsFromPickerSafe(payload: unknown): PickerVariant[] {
  if (!payload) return [];
  const p = payload as PickerVariant[] & { selection?: PickerVariant[] };
  if (Array.isArray(p.selection)) return p.selection;
  if (Array.isArray(p)) return [...p];
  return [];
}

const STEP_RULE_METRICS = [
  { label: "Quantité", value: "TOTAL_ITEM_COUNT" },
  { label: "Montant (prix bundle)", value: "BUNDLE_PRICE" },
  { label: "Quantité d'un variant", value: "VARIANT_QUANTITY" },
  { label: "Variants distincts", value: "DISTINCT_VARIANT_COUNT" },
];

const STEP_RULE_OPS = [
  { label: "Est égal à", value: "EQ" },
  { label: "≥", value: "GTE" },
  { label: "≤", value: "LTE" },
  { label: ">", value: "GT" },
  { label: "<", value: "LT" },
];

function ruleLabel(r: UiStepRule): string {
  const m = STEP_RULE_METRICS.find((x) => x.value === r.metric)?.label ?? r.metric;
  const o = STEP_RULE_OPS.find((x) => x.value === r.operator)?.label ?? r.operator;
  return `${m} ${o} ${r.value}`;
}

type LibCategory = "mep" | "products" | "text" | "media";

function SortableBlockRow({
  block,
  onClick,
  onDelete,
}: {
  block: StorefrontBlockV2;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Box
        padding="200"
        borderWidth="025"
        borderColor="border"
        borderRadius="200"
        background="bg-surface"
      >
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: "var(--p-color-icon-subdued)", flexShrink: 0 }}
            aria-label="Réordonner"
          >
            <Icon source={DragHandleIcon} />
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Button variant="plain" onClick={onClick} fullWidth textAlign="left">
              {blockDisplayLabel(block)}
            </Button>
          </div>
          <Tooltip content="Supprimer ce bloc">
            <Button
              icon={DeleteIcon}
              variant="plain"
              tone="critical"
              onClick={onDelete}
              accessibilityLabel="Supprimer"
            />
          </Tooltip>
        </InlineStack>
      </Box>
    </div>
  );
}

function CategoryRow({
  label,
  isOpen,
  onToggle,
  children,
  id,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "6px 4px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--p-color-text)",
          fontWeight: 500,
          fontSize: "0.8rem",
        }}
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        <Icon source={isOpen ? ChevronDownIcon : ChevronRightIcon} />
      </button>
      <Collapsible id={id} open={isOpen}>
        <div style={{ paddingLeft: 4, paddingBottom: 4 }}>
          {children}
        </div>
      </Collapsible>
    </div>
  );
}

export function SidebarLevel2({
  stepIndex,
  step,
  stepsCount,
  design,
  onDesignChange,
  onStepPatch,
  onStepProductsChange,
  onBack,
  onBlockClick,
  activeTab,
  onTabChange,
}: {
  stepIndex: number;
  step: UiStep;
  stepsCount: number;
  design: StorefrontDesignV2;
  onDesignChange: (d: StorefrontDesignV2) => void;
  onStepPatch: (patch: Partial<UiStep>) => void;
  onStepProductsChange: (products: UiStepProduct[]) => void;
  onBack: () => void;
  onBlockClick: (blockId: string) => void;
  activeTab: number;
  onTabChange: (t: number) => void;
}) {
  const shopifyBridge = useAppBridge();

  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<UiStepRule[]>(step.rules);
  const uploadFetcher = useFetcher<UploadJson>();

  const [showLibrary, setShowLibrary] = useState(false);
  const [libSearch, setLibSearch] = useState("");
  const [libTab, setLibTab] = useState<"elements" | "sections">("elements");
  const [openCats, setOpenCats] = useState<Record<LibCategory, boolean>>({
    mep: true,
    products: true,
    text: false,
    media: false,
  });

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (
      uploadFetcher.state === "idle" &&
      uploadFetcher.data?.ok &&
      uploadFetcher.data.imageUrl
    ) {
      onStepPatch({
        imageUrl: uploadFetcher.data.imageUrl,
        imageGid: uploadFetcher.data.imageGid ?? null,
      });
    }
  }, [uploadFetcher.state, uploadFetcher.data, onStepPatch]);

  const openModal = () => {
    setDraftRules(step.rules);
    setRulesModalOpen(true);
  };

  const saveModal = () => {
    onStepPatch({ rules: draftRules });
    setRulesModalOpen(false);
  };

  const handleImageDrop = (_: File[], accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    uploadFetcher.submit(fd, {
      method: "POST",
      action: "/api/upload",
      encType: "multipart/form-data",
    });
  };

  const openVariantPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "variant",
      multiple: true,
      action: "add",
    });
    const variants = variantsFromPickerSafe(selected);
    if (variants.length === 0) return;
    const existing = new Set(step.products.map((p) => p.variantGid));
    const additions: UiStepProduct[] = [];
    let sort = step.products.length;
    for (const v of variants) {
      if (existing.has(v.id)) continue;
      existing.add(v.id);
      additions.push({
        variantGid: v.id,
        sortOrder: sort++,
        minQuantity: null,
        maxQuantity: null,
        displayName: v.displayName ?? v.id.split("/").pop() ?? v.id,
        imageUrl: v.image?.url ?? null,
        productHandle: v.product?.handle ?? null,
        layoutPreset: "STACK_ADD_TO_QTY",
        styleOverrides: null,
      });
    }
    onStepProductsChange([...step.products, ...additions]);
  };

  const openProductPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
    });
    const sel = (selected as { selection?: Array<Record<string, unknown>> } | null)?.selection;
    if (!Array.isArray(sel) || sel.length === 0) return;

    const existing = new Set(step.products.map((p) => p.variantGid));
    const additions: UiStepProduct[] = [];
    let sort = step.products.length;

    for (const p of sel) {
      const variants = Array.isArray(p.variants) ? (p.variants as Array<Record<string, unknown>>) : [];
      const first = variants[0];
      const firstId = first && typeof first.id === "string" ? first.id : null;
      if (!firstId) continue;
      // ResourcePicker returns numeric IDs; normalize to GID
      const variantGid = firstId.startsWith("gid://")
        ? firstId
        : `gid://shopify/ProductVariant/${firstId}`;
      if (existing.has(variantGid)) continue;
      existing.add(variantGid);

      const title =
        (typeof p.title === "string" && p.title.trim()) ||
        (typeof p.handle === "string" && p.handle.trim()) ||
        variantGid;

      const imageUrl =
        (p.image && typeof (p.image as { url?: unknown }).url === "string"
          ? ((p.image as { url: string }).url as string)
          : null) || null;

      additions.push({
        variantGid,
        sortOrder: sort++,
        minQuantity: null,
        maxQuantity: null,
        displayName: title,
        imageUrl,
        productHandle: typeof p.handle === "string" ? (p.handle as string) : null,
        layoutPreset: "STACK_ADD_TO_QTY",
        styleOverrides: null,
      });
    }

    if (additions.length) {
      onStepProductsChange([...step.products, ...additions]);
    }
  };

  const toggleCat = (cat: LibCategory) =>
    setOpenCats((c) => ({ ...c, [cat]: !c[cat] }));

  const addBlock = (block: StorefrontBlockV2) => {
    onDesignChange({
      ...design,
      version: 2,
      blocks: [...design.blocks, block],
    });
    setShowLibrary(false);
  };

  const deleteBlock = (blockId: string) => {
    onDesignChange({
      ...design,
      version: 2,
      blocks: design.blocks.filter((b) => b.id !== blockId),
    });
  };

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = design.blocks.findIndex((b) => b.id === active.id);
    const newIndex = design.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onDesignChange({
      ...design,
      version: 2,
      blocks: arrayMove(design.blocks, oldIndex, newIndex),
    });
  };

  const backBtn = (
    <Tooltip content="Retour aux étapes">
      <Button
        icon={ArrowLeftIcon}
        variant="plain"
        onClick={onBack}
        accessibilityLabel="Retour aux étapes"
      />
    </Tooltip>
  );

  const layoutTab = (
    <BlockStack gap="300">
      <InlineStack gap="200" blockAlign="center">
        {backBtn}
        <Text as="h3" variant="headingSm">
          {step.name.trim() || `Étape ${stepIndex + 1}`}
        </Text>
      </InlineStack>

      {showLibrary ? (
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h4" variant="headingSm">
              Ajouter un bloc
            </Text>
            <Button variant="plain" onClick={() => setShowLibrary(false)}>
              ✕
            </Button>
          </InlineStack>

          <TextField
            label=""
            labelHidden
            placeholder="Rechercher un bloc…"
            value={libSearch}
            onChange={setLibSearch}
            prefix={<Icon source={SearchIcon} />}
            autoComplete="off"
          />

          <div style={{ display: "flex", gap: 4 }}>
            <Button
              pressed={libTab === "elements"}
              onClick={() => setLibTab("elements")}
              size="slim"
            >
              Éléments
            </Button>
            <Button
              pressed={libTab === "sections"}
              onClick={() => setLibTab("sections")}
              size="slim"
            >
              Sections
            </Button>
          </div>

          <Divider />

          <CategoryRow
            id="cat-mep"
            label="Mise en page"
            isOpen={openCats.mep}
            onToggle={() => toggleCat("mep")}
          >
            <BlockStack gap="100">
              {(libSearch === "" || "barre d'étape".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({ id: newBlockId(), type: "step_bar", style: {} })
                  }
                  disabled={stepsCount < 2}
                >
                  Barre d'étape{stepsCount < 2 ? " (≥2 étapes)" : ""}
                </Button>
              )}
              {(libSearch === "" || "espacement".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({ id: newBlockId(), type: "spacer", height: 24 })
                  }
                >
                  Espacement
                </Button>
              )}
            </BlockStack>
          </CategoryRow>

          <CategoryRow
            id="cat-products"
            label="Produits"
            isOpen={openCats.products}
            onToggle={() => toggleCat("products")}
          >
            <BlockStack gap="100">
              {(libSearch === "" || "liste de produits".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({ id: newBlockId(), type: "product_list" })
                  }
                >
                  Liste de produits
                </Button>
              )}
            </BlockStack>
          </CategoryRow>

          <CategoryRow
            id="cat-text"
            label="Texte"
            isOpen={openCats.text}
            onToggle={() => toggleCat("text")}
          >
            <BlockStack gap="100">
              {(libSearch === "" || "titre".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({
                      id: newBlockId(),
                      type: "heading",
                      text: "Nouveau titre",
                      tag: "h2",
                      style: {
                        fontSize: "1.25rem",
                        color: "var(--p-color-text)",
                        marginBottom: "0.5rem",
                      },
                    })
                  }
                >
                  Titre
                </Button>
              )}
              {(libSearch === "" || "texte".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({
                      id: newBlockId(),
                      type: "text",
                      text: "Nouveau texte",
                      style: { color: "var(--p-color-text)" },
                    })
                  }
                >
                  Texte
                </Button>
              )}
            </BlockStack>
          </CategoryRow>

          <CategoryRow
            id="cat-media"
            label="Médias"
            isOpen={openCats.media}
            onToggle={() => toggleCat("media")}
          >
            <BlockStack gap="100">
              {(libSearch === "" || "image".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({
                      id: newBlockId(),
                      type: "image",
                      url: null,
                      alt: "",
                      style: { maxWidth: "100%" },
                    })
                  }
                >
                  Image
                </Button>
              )}
              {(libSearch === "" || "hero bannière".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({
                      id: newBlockId(),
                      type: "hero",
                      headline: "Titre principal",
                      subtext: "",
                      imageUrl: null,
                      layout: "stack",
                    })
                  }
                >
                  Bannière (Hero)
                </Button>
              )}
              {(libSearch === "" || "split".includes(libSearch.toLowerCase())) && (
                <Button
                  variant="plain"
                  fullWidth
                  textAlign="left"
                  onClick={() =>
                    addBlock({
                      id: newBlockId(),
                      type: "split",
                      title: "Titre",
                      body: "Texte descriptif",
                      imageUrl: null,
                      imageSide: "left",
                    })
                  }
                >
                  Section Split
                </Button>
              )}
            </BlockStack>
          </CategoryRow>
        </BlockStack>
      ) : (
        <BlockStack gap="200">
          {design.blocks.length === 0 ? (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Aucun bloc. Cliquez sur "+ Ajouter une section".
              </Text>
            </Box>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleBlockDragEnd}
            >
              <SortableContext
                items={design.blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <BlockStack gap="150">
                  {design.blocks.map((block) => (
                    <SortableBlockRow
                      key={block.id}
                      block={block}
                      onClick={() => onBlockClick(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  ))}
                </BlockStack>
              </SortableContext>
            </DndContext>
          )}
          <Button
            onClick={() => setShowLibrary(true)}
            fullWidth
          >
            + Ajouter une section
          </Button>
        </BlockStack>
      )}
    </BlockStack>
  );

  const settingsTab = (
    <BlockStack gap="300">
      <InlineStack gap="200" blockAlign="center">
        {backBtn}
        <Text as="h3" variant="headingSm">
          {step.name.trim() || `Étape ${stepIndex + 1}`}
        </Text>
      </InlineStack>

      <TextField
        label="Nom de l'étape"
        value={step.name}
        onChange={(v) => onStepPatch({ name: v })}
        autoComplete="off"
      />
      <TextField
        label="Description"
        value={step.description}
        onChange={(v) => onStepPatch({ description: v })}
        multiline={3}
        autoComplete="off"
      />
      <Checkbox
        label="Étape finale (options additionnelles)"
        checked={step.isFinalStep}
        onChange={(v) => onStepPatch({ isFinalStep: v })}
      />

      <Divider />
      <Text as="h4" variant="headingSm">
        Icône d'étape
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        JPEG, PNG, WebP, SVG — max 20 Mo
      </Text>
      {step.imageUrl ? (
        <InlineStack gap="200" blockAlign="center">
          <Thumbnail source={step.imageUrl} alt="" size="small" />
          <Button
            variant="plain"
            tone="critical"
            onClick={() => onStepPatch({ imageUrl: null, imageGid: null })}
          >
            Retirer
          </Button>
        </InlineStack>
      ) : (
        <DropZone
          onDrop={handleImageDrop}
          allowMultiple={false}
          accept="image/*"
          disabled={uploadFetcher.state !== "idle"}
        >
          <DropZone.FileUpload actionHint="JPEG, PNG, WebP, SVG" />
        </DropZone>
      )}

      <Divider />
      <Text as="h4" variant="headingSm">
        Produits éligibles
      </Text>
      <InlineStack gap="200" wrap>
        <Button onClick={openVariantPicker}>Sélectionner des variants</Button>
        <Button onClick={openProductPicker} variant="secondary">
          Sélectionner des produits
        </Button>
      </InlineStack>
      {step.products.length === 0 ? (
        <Text as="p" variant="bodySm" tone="subdued">
          Aucun variant sélectionné.
        </Text>
      ) : (
        <BlockStack gap="200">
          {step.products.map((p, pi) => (
            <Box
              key={p.variantGid}
              padding="200"
              borderWidth="025"
              borderColor="border"
              borderRadius="200"
              background="bg-surface"
            >
              <InlineStack gap="200" blockAlign="center" wrap={false}>
                {p.imageUrl ? (
                  <Thumbnail source={p.imageUrl} alt="" size="small" />
                ) : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text as="p" variant="bodySm" truncate>
                    {p.displayName}
                  </Text>
                </div>
                <Button
                  variant="plain"
                  tone="critical"
                  onClick={() =>
                    onStepProductsChange(step.products.filter((_, k) => k !== pi))
                  }
                  accessibilityLabel="Retirer"
                >
                  ✕
                </Button>
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      )}

      <Divider />
      <Text as="h4" variant="headingSm">
        Sélections requises
      </Text>
      {step.rules.length > 0 ? (
        <Box padding="200" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="100">
            {step.rules.map((r, i) => (
              <Text key={i} as="p" variant="bodySm">
                {ruleLabel(r)}
              </Text>
            ))}
          </BlockStack>
        </Box>
      ) : (
        <Text as="p" variant="bodySm" tone="subdued">
          Aucune condition définie.
        </Text>
      )}
      <Button onClick={openModal}>Modifier les conditions</Button>
    </BlockStack>
  );

  return (
    <>
      <Tabs
        fitted
        tabs={[
          {
            id: "layout",
            content: "Mise en page",
            accessibilityLabel: "Mise en page",
          },
          {
            id: "settings",
            content: "",
            icon: (
              <Tooltip content="Paramètres">
                <Icon source={SettingsIcon} />
              </Tooltip>
            ),
            accessibilityLabel: "Paramètres",
          },
        ]}
        selected={activeTab}
        onSelect={onTabChange}
      >
        <Box paddingBlockStart="400">
          {activeTab === 0 ? layoutTab : settingsTab}
        </Box>
      </Tabs>

      <Modal
        open={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        title="Sélections requises"
        primaryAction={{ content: "Enregistrer", onAction: saveModal }}
        secondaryActions={[
          {
            content: "Annuler",
            onAction: () => setRulesModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodySm" tone="subdued">
              Définissez combien de produits (Quantité) ou quelle valeur totale
              (Montant) les clients doivent atteindre à cette étape pour continuer.
            </Text>
            <BlockStack gap="300">
              {draftRules.map((r, i) => (
                <InlineStack key={i} gap="200" blockAlign="end" wrap>
                  <div style={{ flex: "1 1 140px", minWidth: 110 }}>
                    <Select
                      label="Métrique"
                      options={STEP_RULE_METRICS}
                      value={r.metric}
                      onChange={(v) => {
                        const next = [...draftRules];
                        const cur = next[i];
                        if (cur) next[i] = { ...cur, metric: v };
                        setDraftRules(next);
                      }}
                    />
                  </div>
                  <div style={{ flex: "1 1 140px", minWidth: 110 }}>
                    <Select
                      label="Opérateur"
                      options={STEP_RULE_OPS}
                      value={r.operator}
                      onChange={(v) => {
                        const next = [...draftRules];
                        const cur = next[i];
                        if (cur) next[i] = { ...cur, operator: v };
                        setDraftRules(next);
                      }}
                    />
                  </div>
                  <div style={{ flex: "2 1 80px", minWidth: 60 }}>
                    <TextField
                      label="Valeur"
                      value={r.value}
                      onChange={(v) => {
                        const next = [...draftRules];
                        const cur = next[i];
                        if (cur) next[i] = { ...cur, value: v };
                        setDraftRules(next);
                      }}
                      autoComplete="off"
                      type="number"
                    />
                  </div>
                  <div style={{ paddingBottom: 4 }}>
                    <Button
                      icon={DeleteIcon}
                      variant="plain"
                      tone="critical"
                      onClick={() =>
                        setDraftRules(draftRules.filter((_, j) => j !== i))
                      }
                      accessibilityLabel="Supprimer la condition"
                    />
                  </div>
                </InlineStack>
              ))}
              <Button
                onClick={() =>
                  setDraftRules([
                    ...draftRules,
                    {
                      sortOrder: draftRules.length,
                      metric: "TOTAL_ITEM_COUNT",
                      operator: "EQ",
                      value: "1",
                      targetVariantGid: "",
                    },
                  ])
                }
              >
                + Ajouter une condition
              </Button>
            </BlockStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

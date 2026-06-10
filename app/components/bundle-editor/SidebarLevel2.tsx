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
  DuplicateIcon,
  HideIcon,
  MenuHorizontalIcon,
  SettingsIcon,
  ViewIcon,
  PlusIcon,
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

type VariantsMetaJson = {
  items: Array<{
    id: string;
    displayTitle: string;
    imageUrl: string | null;
    productHandle: string | null;
  }>;
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

type LibCategory = "mep" | "text" | "media";

function ensurePermanentProductBlock(design: StorefrontDesignV2): StorefrontDesignV2 {
  // product_list is now optional — do not auto-inject it
  return design;
}

import {
  ListNumberedIcon,
  ProductListIcon,
  TextTitleIcon,
  TextBlockIcon,
  ImageIcon,
  TextInColumnsIcon,
  LayoutSidebarRightIcon,
  LayoutBlockIcon,
  ButtonIcon,
  MinusIcon,
  QuestionCircleIcon,
  ShieldCheckMarkIcon,
} from "@shopify/polaris-icons";

function blockIconSource(type: string) {
  switch (type) {
    case "step_bar": return ListNumberedIcon;
    case "product_list": return ProductListIcon;
    case "heading": return TextTitleIcon;
    case "text": return TextBlockIcon;
    case "image": return ImageIcon;
    case "spacer": return TextInColumnsIcon;
    case "hero": return LayoutBlockIcon;
    case "split": return LayoutSidebarRightIcon;
    case "button": return ButtonIcon;
    case "divider": return MinusIcon;
    case "faq": return QuestionCircleIcon;
    case "trust_badges": return ShieldCheckMarkIcon;
    default: return TextBlockIcon;
  }
}

/** Native-styled library item (icon + label) for the block catalog */
function LibraryItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 8px",
        background: "none",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "var(--p-color-text-disabled)" : "var(--p-color-text)",
        fontSize: "13px",
        textAlign: "left",
      }}
      onMouseOver={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--p-color-bg-surface-hover)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = "none";
      }}
    >
      <span style={{ width: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon source={icon} tone={disabled ? "subdued" : "base"} />
      </span>
      <span>{label}</span>
    </button>
  );
}

function SortableBlockRow({
  block,
  onClick,
  onDelete,
  onDuplicate,
  isLocked,
  isHidden,
  onToggleVisibility,
}: {
  block: StorefrontBlockV2;
  onClick: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isLocked?: boolean;
  isHidden?: boolean;
  onToggleVisibility: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const [menuOpen, setMenuOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isHidden ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() =>
        window.dispatchEvent(new CustomEvent('sar-admin-hover-block', { detail: block.id }))
      }
      onMouseLeave={() =>
        window.dispatchEvent(new CustomEvent('sar-admin-hover-block', { detail: null }))
      }
    >
      <Box
        padding="200"
        borderWidth="025"
        borderColor="border"
        borderRadius="200"
        background="bg-surface"
      >
        <InlineStack gap="100" blockAlign="center" wrap={false}>
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", color: "var(--p-color-icon-subdued)", flexShrink: 0 }}
            aria-label="Réordonner"
          >
            <Icon source={DragHandleIcon} />
          </div>
          <span style={{ flexShrink: 0, width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon source={blockIconSource(block.type)} tone="base" />
          </span>
          <div
            style={{ flex: 1, minWidth: 0, overflow: "hidden", cursor: "pointer" }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
          >
            <Text as="span" variant="bodyMd" truncate>
              {blockDisplayLabel(block)}
            </Text>
          </div>
          <Tooltip content={isHidden ? "Afficher" : "Masquer"}>
            <Button
              variant="plain"
              onClick={onToggleVisibility}
              accessibilityLabel={isHidden ? "Afficher" : "Masquer"}
              icon={isHidden ? HideIcon : ViewIcon}
            />
          </Tooltip>
          <div style={{ position: "relative" }}>
            <Tooltip content="Actions">
              <Button
                variant="plain"
                onClick={() => setMenuOpen(!menuOpen)}
                accessibilityLabel="Actions"
                icon={MenuHorizontalIcon}
              />
            </Tooltip>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  zIndex: 100,
                  background: "var(--p-color-bg-surface)",
                  border: "1px solid var(--p-color-border)",
                  borderRadius: 8,
                  boxShadow: "var(--p-shadow-300)",
                  minWidth: 140,
                  padding: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => { onDuplicate(); setMenuOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, width: "100%",
                    padding: "6px 10px", background: "none", border: "none",
                    cursor: "pointer", fontSize: "13px", borderRadius: 6,
                    color: "var(--p-color-text)",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "var(--p-color-bg-surface-hover)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                >
                  <Icon source={DuplicateIcon} /> Dupliquer
                </button>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() => { onDelete(); setMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, width: "100%",
                      padding: "6px 10px", background: "none", border: "none",
                      cursor: "pointer", fontSize: "13px", borderRadius: 6,
                      color: "var(--p-color-text-critical)",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "var(--p-color-bg-surface-hover)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <Icon source={DeleteIcon} /> Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
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

/** Panneau de bibliothèque de blocs — rendu dans une colonne séparée par BundleVisualEditor */
export function BlockLibraryPanel({
  onAdd,
  onClose,
}: {
  onAdd: (block: StorefrontBlockV2) => void;
  onClose: () => void;
}) {
  const addBlock = (block: StorefrontBlockV2) => { onAdd(block); onClose(); };

  const groups: Array<{ label: string; items: Array<{ icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>; label: string; block: () => StorefrontBlockV2 }> }> = [
    {
      label: "Mise en page",
      items: [
        { icon: ListNumberedIcon, label: "Barre d'étape", block: () => ({ id: newBlockId(), type: "step_bar", style: {} }) },
        { icon: ProductListIcon, label: "Liste de produits", block: () => ({ id: newBlockId(), type: "product_list", cardLayout: "classic", columns: 3, columnsMobile: 2, source: "all_products" }) },
        { icon: PlusIcon, label: "Options / Sous-produits", block: () => ({ id: newBlockId(), type: "upsell", title: "Complétez votre commande", behavior: "multiple", items: [] }) },
        { icon: TextInColumnsIcon, label: "Espacement", block: () => ({ id: newBlockId(), type: "spacer", height: 24 }) },
        { icon: MinusIcon, label: "Séparateur", block: () => ({ id: newBlockId(), type: "divider", thickness: 1, lineStyle: "solid", spacing: 16 }) },
        { icon: ShieldCheckMarkIcon, label: "Badges de confiance", block: () => ({ id: newBlockId(), type: "trust_badges", align: "center", iconSize: 32, items: [{ id: newBlockId(), label: "Paiement sécurisé" }, { id: newBlockId(), label: "Livraison rapide" }, { id: newBlockId(), label: "Satisfait ou remboursé" }] }) },
      ],
    },
    {
      label: "Texte",
      items: [
        { icon: TextTitleIcon, label: "Titre", block: () => ({ id: newBlockId(), type: "heading", text: "Composez votre coffret", tag: "h2", style: { fontSize: "1.75rem", fontWeight: "700", color: "#1f2937", textAlign: "center" } }) },
        { icon: TextBlockIcon, label: "Texte", block: () => ({ id: newBlockId(), type: "text", text: "Sélectionnez vos produits préférés.", style: { fontSize: "1rem", color: "#6b7280", textAlign: "center" } }) },
        { icon: ButtonIcon, label: "Bouton / CTA", block: () => ({ id: newBlockId(), type: "button", text: "Ajouter au panier", action: "scroll_to_bundle", fullWidth: true, style: { backgroundColor: "#1f2937", color: "#ffffff", fontSize: "1rem", fontWeight: "600", padding: "14px 28px", borderRadius: "10px" } }) },
        { icon: QuestionCircleIcon, label: "FAQ", block: () => ({ id: newBlockId(), type: "faq", allowMultipleOpen: false, items: [{ id: newBlockId(), question: "Votre question ?", answer: "Votre réponse." }], style: {} }) },
      ],
    },
    {
      label: "Médias",
      items: [
        { icon: ImageIcon, label: "Image", block: () => ({ id: newBlockId(), type: "image", url: null, alt: "", style: { maxWidth: "100%" } }) },
        { icon: LayoutBlockIcon, label: "Bannière (Hero)", block: () => ({ id: newBlockId(), type: "hero", headline: "Votre coffret sur mesure", subtext: "Composez, personnalisez, économisez.", imageUrl: null, layout: "stack", style: { padding: "2.5rem 2rem", backgroundColor: "#f7f5f2", borderRadius: "16px", textAlign: "center", color: "#1f2937" } }) },
        { icon: LayoutSidebarRightIcon, label: "Section Split", block: () => ({ id: newBlockId(), type: "split", title: "Pourquoi nos coffrets ?", body: "Des produits sélectionnés avec soin.", imageUrl: null, imageSide: "left", style: { padding: "1.5rem", backgroundColor: "#ffffff", borderRadius: "12px", color: "#1f2937" } }) },
      ],
    },
  ];

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 8px" }}>
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--p-color-text)" }}>Ajouter un bloc</span>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--p-color-text-subdued)", fontSize: 18, lineHeight: 1, padding: "2px 4px" }}
          aria-label="Fermer"
        >✕</button>
      </div>
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 8 }}>
          <div style={{ padding: "4px 4px 2px", fontSize: "0.7rem", fontWeight: 600, color: "var(--p-color-text-subdued)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {group.label}
          </div>
          {group.items.map((item) => (
            <LibraryItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              onClick={() => addBlock(item.block() as StorefrontBlockV2)}
            />
          ))}
        </div>
      ))}
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
  onToggleBlockVisibility,
  onRequestLibrary,
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
  onToggleBlockVisibility: (blockId: string, isHidden: boolean) => void;
  onRequestLibrary?: () => void;
}) {
  const shopifyBridge = useAppBridge();
  const safeDesign = ensurePermanentProductBlock(design);
  useEffect(() => {
    if (safeDesign !== design) {
      onDesignChange(safeDesign);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeDesign.version, safeDesign.blocks.length]);

  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<UiStepRule[]>(step.rules);
  const uploadFetcher = useFetcher<UploadJson>();
  const variantsMetaFetcher = useFetcher<VariantsMetaJson>();

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

  useEffect(() => {
    if (variantsMetaFetcher.state !== "idle" || !variantsMetaFetcher.data) return;
    const byId = new Map(variantsMetaFetcher.data.items.map((x) => [x.id, x]));
    if (byId.size === 0) return;
    onStepProductsChange(
      step.products.map((p) => {
        const meta = byId.get(p.variantGid);
        if (!meta) return p;
        return {
          ...p,
          displayName: meta.displayTitle || p.displayName,
          imageUrl: meta.imageUrl ?? p.imageUrl,
          productHandle: meta.productHandle ?? p.productHandle,
          // Prix : indispensable pour l'affichage dans l'aperçu (sf.priceAmount)
          priceAmount: meta.priceAmount ?? p.priceAmount,
          currencyCode: meta.currencyCode ?? p.currencyCode,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsMetaFetcher.state, variantsMetaFetcher.data]);

  const enrichVariants = (gids: string[]) => {
    if (gids.length === 0) return;
    const params = new URLSearchParams();
    for (const id of gids) params.append("ids", id);
    variantsMetaFetcher.load(`/api/shopify-variants?${params.toString()}`);
  };

  // Auto-enrich variants on mount when products have missing images/names
  useEffect(() => {
    const needsEnrich = step.products.filter((p) => {
      const name = (p.displayName ?? "").trim();
      const looksLikeId = /^\d{8,}$/.test(name);
      return (
        !p.imageUrl ||
        !name ||
        looksLikeId ||
        name.toLowerCase() === "default title" ||
        !p.productHandle ||
        !p.priceAmount
      );
    });
    if (needsEnrich.length > 0) {
      enrichVariants(needsEnrich.map((p) => p.variantGid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

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
    const missing = additions
      .filter((a) => {
        const name = (a.displayName ?? "").trim();
        const looksLikeId = /^\d{8,}$/.test(name);
        return (
          !a.imageUrl ||
          !name ||
          looksLikeId ||
          name.toLowerCase() === "default title" ||
          !a.productHandle ||
          !a.priceAmount
        );
      })
      .map((a) => a.variantGid);
    if (missing.length) enrichVariants(missing);
  };

  const openProductPicker = async () => {
    const selected = await shopifyBridge.resourcePicker({
      type: "product",
      multiple: true,
      action: "add",
    });
    // App Bridge v4 renvoie un tableau ; v3 renvoie { selection: [] }.
    const sel = Array.isArray(selected)
      ? (selected as Array<Record<string, unknown>>)
      : (selected as unknown as { selection?: Array<Record<string, unknown>> } | null)?.selection;
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
      const missing = additions
        .filter((a) => {
          const name = (a.displayName ?? "").trim();
          const looksLikeId = /^\d{8,}$/.test(name);
          return !a.imageUrl || !name || looksLikeId || !a.productHandle || !a.priceAmount;
        })
        .map((a) => a.variantGid);
      if (missing.length) enrichVariants(missing);
    }
  };

  const deleteBlock = (blockId: string) => {
    onDesignChange({
      ...safeDesign,
      version: 2,
      blocks: safeDesign.blocks.filter((b) => b.id !== blockId),
    });
  };

  const duplicateBlock = (blockId: string) => {
    const src = safeDesign.blocks.find((b) => b.id === blockId);
    if (!src) return;
    const dup = { ...src, id: newBlockId() } as StorefrontBlockV2;
    const idx = safeDesign.blocks.findIndex((b) => b.id === blockId);
    const newBlocks = [...safeDesign.blocks];
    newBlocks.splice(idx + 1, 0, dup);
    onDesignChange({ ...safeDesign, version: 2, blocks: newBlocks });
  };

  // toggleBlockVisibility is now provided by parent via props

  const handleBlockDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = safeDesign.blocks.findIndex((b) => b.id === active.id);
    const newIndex = safeDesign.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onDesignChange({
      ...safeDesign,
      version: 2,
      blocks: arrayMove(safeDesign.blocks, oldIndex, newIndex),
    });
  };

  const backBtn = (
    <Tooltip content="Retour aux étapes">
      <Button icon={ArrowLeftIcon} variant="tertiary" onClick={onBack}>
        Retour
      </Button>
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

      <BlockStack gap="200">
        {safeDesign.blocks.length === 0 ? (
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Aucun bloc pour cette étape.
            </Text>
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleBlockDragEnd}
          >
            <SortableContext
              items={safeDesign.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <BlockStack gap="150">
                {safeDesign.blocks.map((block) => (
                  <SortableBlockRow
                    key={block.id}
                    block={block}
                    onClick={() => onBlockClick(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    isLocked={false}
                    isHidden={block.isHidden}
                    onToggleVisibility={() => onToggleBlockVisibility(block.id, !block.isHidden)}
                  />
                ))}
              </BlockStack>
            </SortableContext>
          </DndContext>
        )}
        <Button
          onClick={() => onRequestLibrary?.()}
          fullWidth
        >
          + Ajouter un bloc
        </Button>
      </BlockStack>
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
            content: "Design",
            accessibilityLabel: "Design",
          },
          {
            id: "settings",
            content: "Paramètres",
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

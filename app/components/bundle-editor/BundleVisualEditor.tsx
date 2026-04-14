import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  RangeSlider,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
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
import { DragHandleIcon, DeleteIcon, PlusIcon } from "@shopify/polaris-icons";
import { BundleIframePreview } from "./BundleIframePreview";
// BundleStorefrontPreview conservé mais remplacé par l'iframe (parité 100% storefront)
// import { BundleStorefrontPreview } from "./BundleStorefrontPreview";
import { SidebarLevel2 } from "./SidebarLevel2";
import { SidebarLevel3 } from "./SidebarLevel3";
import {
  emptyStep,
  type BundleFormState,
  type UiStep,
} from "../../utils/bundle-form.client";
import type { StorefrontDesignV2 } from "../../utils/storefront-design";

/* ── Inline colour picker (circle swatch + hex text field) ── */
function GlobalColorField({
  label,
  value,
  onChange,
  placeholder,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Text as="span" variant="bodyMd">{label}</Text>
        {helpText && (
          <div style={{ marginTop: 2 }}>
            <Text as="span" variant="bodySm" tone="subdued">{helpText}</Text>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid var(--p-color-border)",
            cursor: "pointer",
            overflow: "hidden",
            position: "relative",
            background: value || placeholder || "#ffffff",
            flexShrink: 0,
          }}
        >
          <input
            type="color"
            value={value || placeholder || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        </label>
        <div style={{ flex: 1 }}>
          <TextField
            label={label}
            labelHidden
            value={value}
            onChange={onChange}
            autoComplete="off"
            placeholder={placeholder}
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--p-color-text-subdued)",
              fontSize: 16,
              padding: 4,
              flexShrink: 0,
            }}
            title="Réinitialiser"
          >✕</button>
        )}
      </div>
    </div>
  );
}

type SidebarLevel =
  | { level: 1 }
  | { level: "global" }
  | { level: 2; stepIndex: number; activeTab: number }
  | { level: 3; stepIndex: number; blockId: string; activeTab: number };

function SortableStepRow({
  step,
  index,
  onClick,
  onDelete,
}: {
  step: UiStep;
  index: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(index) });

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
          <div
            style={{ flex: 1, minWidth: 0, overflow: "hidden", cursor: "pointer" }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
          >
            <Text as="span" variant="bodyMd" truncate>
              {step.name.trim() || `Étape ${index + 1}`}
            </Text>
          </div>
          <Tooltip content="Supprimer l'étape">
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

export function BundleVisualEditor({
  form,
  setForm,
}: {
  form: BundleFormState;
  setForm: Dispatch<SetStateAction<BundleFormState>>;
}) {
  const [nav, setNav] = useState<SidebarLevel>({ level: 1 });
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (nav.level === 2 || nav.level === 3) {
      const si = nav.stepIndex;
      if (si >= form.steps.length) {
        setNav({ level: 1 });
      }
    }
  }, [form.steps.length, nav]);

  const patchStep = useCallback(
    (stepIndex: number, patch: Partial<UiStep>) => {
      setForm((f) => ({
        ...f,
        steps: f.steps.map((s, i) =>
          i === stepIndex ? { ...s, ...patch } : s,
        ),
      }));
    },
    [setForm],
  );

  // Returns the effective design for a given step (per-step override or global).
  // step_bar blocks are always global and excluded from per-step blocks.
  const getStepDesign = useCallback(
    (stepIdx: number): StorefrontDesignV2 => {
      const globalDesign = form.storefrontDesign;
      const key = String(stepIdx);
      const stepBlocks = globalDesign.stepDesigns?.[key];
      if (stepBlocks !== undefined) {
        // step_bar always comes from global, never from per-step designs
        const globalStepBars = globalDesign.blocks.filter((b) => b.type === "step_bar");
        const perStepBlocks = stepBlocks.filter((b) => b.type !== "step_bar");
        return { ...globalDesign, blocks: [...globalStepBars, ...perStepBlocks] };
      }
      // First access to this step: return global blocks without step_bar (added separately above)
      return { ...globalDesign };
    },
    [form.storefrontDesign],
  );

  const patchDesign = useCallback(
    (next: StorefrontDesignV2) => {
      setForm((f) => ({ ...f, storefrontDesign: next }));
    },
    [setForm],
  );

  // Patches the per-step design (stepDesigns[stepIdx].blocks).
  // step_bar blocks are excluded since they live in global blocks only.
  const patchStepDesign = useCallback(
    (stepIdx: number, next: StorefrontDesignV2) => {
      setForm((f) => {
        const key = String(stepIdx);
        const global = f.storefrontDesign;
        // Extract any step_bar changes to the global blocks
        const stepBarBlocks = next.blocks.filter((b) => b.type === "step_bar");
        const nonStepBarBlocks = next.blocks.filter((b) => b.type !== "step_bar");
        // If step_bar blocks changed, update global blocks
        const updatedGlobalBlocks = stepBarBlocks.length > 0
          ? [
              ...global.blocks.filter((b) => b.type !== "step_bar"),
              ...stepBarBlocks,
            ]
          : global.blocks;
        return {
          ...f,
          storefrontDesign: {
            ...global,
            blocks: updatedGlobalBlocks,
            stepDesigns: {
              ...(global.stepDesigns ?? {}),
              [key]: nonStepBarBlocks,
            },
          },
        };
      });
    },
    [setForm],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      if (nav.level === 2 || nav.level === 3) {
        const stepIdx = nav.stepIndex;
        const key = String(stepIdx);
        setForm((f) => {
          const global = f.storefrontDesign;
          const currentBlocks = global.stepDesigns?.[key] ?? global.blocks;
          return {
            ...f,
            storefrontDesign: {
              ...global,
              stepDesigns: {
                ...(global.stepDesigns ?? {}),
                [key]: currentBlocks.filter((b) => b.id !== blockId),
              },
            },
          };
        });
      } else {
        setForm((f) => ({
          ...f,
          storefrontDesign: {
            ...f.storefrontDesign,
            version: 2,
            blocks: f.storefrontDesign.blocks.filter((b) => b.id !== blockId),
          },
        }));
      }
      setNav((n) =>
        n.level === 3 ? { level: 2, stepIndex: n.stepIndex, activeTab: 0 } : n,
      );
    },
    [setForm],
  );

  const toggleBlockVisibility = useCallback((blockId: string, forceToggle?: boolean) => {
    setForm((f) => {
      const next = { ...f };
      let found = false;

      // Update in stepOverrides if currently browsing a step
      if (nav.level === 3 || next.storefrontDesign.stepDesigns?.[nav.stepIndex]) {
        const key = String(nav.stepIndex);
        const override = next.storefrontDesign.stepDesigns?.[key];
        if (override) {
          next.storefrontDesign.stepDesigns[key] = override.map((b) => {
            if (b.id === blockId) {
              found = true;
              return { ...b, isHidden: forceToggle !== undefined ? forceToggle : !b.isHidden };
            }
            return b;
          });
        }
      }

      // Always also update global if not found in override or in global nav
      if (!found || nav.level === 2) {
        next.storefrontDesign.blocks = next.storefrontDesign.blocks.map((b) => {
          if (b.id === blockId) {
            return { ...b, isHidden: forceToggle !== undefined ? forceToggle : !b.isHidden };
          }
          return b;
        });
      }

      return next;
    });
  }, [setForm, nav]);

  const addStep = () => {
    setForm((f) => ({ ...f, steps: [...f.steps, emptyStep(f.steps.length)] }));
  };

  const deleteStep = (i: number) => {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
    setNav((n) => {
      if (n.level === 1 || n.level === "global") return n;
      if (n.stepIndex === i) return { level: 1 };
      if (n.stepIndex > i) return { ...n, stepIndex: n.stepIndex - 1 };
      return n;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = Number(active.id);
    const newIndex = Number(over.id);
    setForm((f) => ({
      ...f,
      steps: arrayMove(f.steps, oldIndex, newIndex),
    }));
    setNav((n) => {
      if (n.level === 1 || n.level === "global") return n;
      if (n.stepIndex === oldIndex) return { ...n, stepIndex: newIndex };
      return n;
    });
  };

  const activeStepIndex = (nav.level === 1 || nav.level === "global") ? 0 : nav.stepIndex;
  const currentStep = form.steps[activeStepIndex];
  const productCount = currentStep?.products.length ?? 0;

  const renderSidebar = () => {
    if (nav.level === 1) {
      return (
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              Étapes
            </Text>
            <Tooltip content="Ajouter une étape">
              <Button
                icon={PlusIcon}
                variant="plain"
                onClick={addStep}
                accessibilityLabel="Ajouter une étape"
              />
            </Tooltip>
          </InlineStack>

          {form.steps.length === 0 ? (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Aucune étape. Cliquez sur "+" pour en ajouter une.
              </Text>
            </Box>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={form.steps.map((_, i) => String(i))}
                strategy={verticalListSortingStrategy}
              >
                <BlockStack gap="150">
                  {form.steps.map((s, i) => (
                    <SortableStepRow
                      key={i}
                      step={s}
                      index={i}
                      onClick={() => setNav({ level: 2, stepIndex: i, activeTab: 0 })}
                      onDelete={() => deleteStep(i)}
                    />
                  ))}
                </BlockStack>
              </SortableContext>
            </DndContext>
          )}

          <Button variant="primary" onClick={addStep} fullWidth>
            + Ajouter une étape
          </Button>

          <Box paddingBlockStart="400" paddingBlockEnd="200">
            <Text as="h3" variant="headingSm">
              Apparence de la section
            </Text>
          </Box>
          <Button
            onClick={() => setNav({ level: "global" })}
            fullWidth
            textAlign="left"
          >
            🎨 Éditer les Couleurs et Polices
          </Button>
        </BlockStack>
      );
    }

    if (nav.level === "global") {
      const g = form.storefrontDesign.global || {};
      const updateGlobal = (patch: Partial<StorefrontDesignV2["global"]>) => {
        patchDesign({
          ...form.storefrontDesign,
          version: 2,
          global: { ...g, ...patch },
        });
      };

      return (
        <BlockStack gap="300">
          <InlineStack gap="200" blockAlign="center">
            <Tooltip content="Retour">
              <Button onClick={() => setNav({ level: 1 })} variant="plain" accessibilityLabel="Retour">
                ← Retour
              </Button>
            </Tooltip>
            <Text as="h2" variant="headingMd">
              Styles Globaux
            </Text>
          </InlineStack>

          <Box paddingBlockStart="200">
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">Section</Text>
              <GlobalColorField
                label="Couleur des bordures"
                value={g.colorBorder ?? ""}
                onChange={(v) => updateGlobal({ colorBorder: v || undefined })}
                placeholder="#e1e3e5"
              />
              <GlobalColorField
                label="Arrière-plan"
                value={g.colorBackground ?? ""}
                onChange={(v) => updateGlobal({ colorBackground: v || undefined })}
                placeholder="#ffffff"
              />
              <Text as="h3" variant="headingSm">Bande « Total du pack »</Text>
              <GlobalColorField
                label="Arrière-plan du total"
                value={g.totalBg ?? ""}
                onChange={(v) => updateGlobal({ totalBg: v || undefined })}
                placeholder="#f6f6f7"
              />
              <GlobalColorField
                label="Bordure du total"
                value={g.totalBorderColor ?? ""}
                onChange={(v) => updateGlobal({ totalBorderColor: v || undefined })}
                placeholder="#e1e3e5"
              />
              <GlobalColorField
                label="Texte du total"
                value={g.totalTextColor ?? ""}
                onChange={(v) => updateGlobal({ totalTextColor: v || undefined })}
                placeholder="#121212"
              />
              <Text as="h3" variant="headingSm">Boutons navigation</Text>
              <GlobalColorField
                label="Fond — Suivant / Ajouter au panier"
                value={g.btnPrimaryBg ?? ""}
                onChange={(v) => updateGlobal({ btnPrimaryBg: v || undefined })}
                placeholder="#555555"
              />
              <GlobalColorField
                label="Texte — Suivant / Ajouter au panier"
                value={g.btnPrimaryColor ?? ""}
                onChange={(v) => updateGlobal({ btnPrimaryColor: v || undefined })}
                placeholder="#ffffff"
              />
              <GlobalColorField
                label="Fond survol — Suivant / Ajouter"
                value={g.btnPrimaryHoverBg ?? ""}
                onChange={(v) => updateGlobal({ btnPrimaryHoverBg: v || undefined })}
                placeholder="#333333"
              />
              <GlobalColorField
                label="Fond — Précédent"
                value={g.btnSecondaryBg ?? ""}
                onChange={(v) => updateGlobal({ btnSecondaryBg: v || undefined })}
                placeholder="transparent"
              />
              <GlobalColorField
                label="Texte & bordure — Précédent"
                value={g.btnSecondaryColor ?? ""}
                onChange={(v) => updateGlobal({ btnSecondaryColor: v || undefined, btnSecondaryBorderColor: v || undefined })}
                placeholder="#555555"
              />
              <div>
                <Text as="span" variant="bodyMd">Épaisseur de la bordure</Text>
                <RangeSlider
                  label="Épaisseur de la bordure"
                  labelHidden
                  min={0}
                  max={6}
                  step={1}
                  value={parseInt(g.borderWidth ?? "1", 10) || 1}
                  onChange={(v) => updateGlobal({ borderWidth: String(typeof v === "number" ? v : v[0]) })}
                  output
                  suffix={<span style={{ minWidth: 24, textAlign: "right" }}>{g.borderWidth ?? "1"}px</span>}
                />
              </div>
              <div>
                <Text as="span" variant="bodyMd">Rayon des coins</Text>
                <RangeSlider
                  label="Rayon des coins"
                  labelHidden
                  min={0}
                  max={32}
                  step={2}
                  value={parseInt(g.borderRadius ?? "8", 10) || 8}
                  onChange={(v) => updateGlobal({ borderRadius: String(typeof v === "number" ? v : v[0]) })}
                  output
                  suffix={<span style={{ minWidth: 24, textAlign: "right" }}>{g.borderRadius ?? "8"}px</span>}
                />
              </div>
            </BlockStack>
          </Box>
        </BlockStack>
      );
    }

    if (nav.level === 2) {
      const step = form.steps[nav.stepIndex];
      if (!step) {
        setNav({ level: 1 });
        return null;
      }
      const stepDesign = getStepDesign(nav.stepIndex);
      return (
        <SidebarLevel2
          stepIndex={nav.stepIndex}
          step={step}
          stepsCount={form.steps.length}
          design={stepDesign}
          onDesignChange={(next) => patchStepDesign(nav.stepIndex, next)}
          onStepPatch={(patch) => patchStep(nav.stepIndex, patch)}
          onStepProductsChange={(products) =>
            patchStep(nav.stepIndex, { products })
          }
          onBack={() => setNav({ level: 1 })}
          onBlockClick={(blockId) =>
            setNav({
              level: 3,
              stepIndex: nav.stepIndex,
              blockId,
              activeTab: 0,
            })
          }
          activeTab={nav.activeTab}
          onTabChange={(t) => setNav({ ...nav, activeTab: t })}
          onToggleBlockVisibility={toggleBlockVisibility}
        />
      );
    }

    if (nav.level === 3) {
      const step = form.steps[nav.stepIndex];
      const stepName = step?.name.trim() || `Étape ${nav.stepIndex + 1}`;
      const stepDesign = getStepDesign(nav.stepIndex);
      return (
        <SidebarLevel3
          blockId={nav.blockId}
          stepName={stepName}
          stepIndex={nav.stepIndex}
          step={step}
          design={stepDesign}
          onDesignChange={(next) => patchStepDesign(nav.stepIndex, next)}
          onStepPatch={(patch) => patchStep(nav.stepIndex, patch)}
          onStepProductsChange={(products) =>
            patchStep(nav.stepIndex, { products })
          }
          onBack={() =>
            setNav({ level: 2, stepIndex: nav.stepIndex, activeTab: 0 })
          }
          onGoToSettings={() =>
            setNav({ level: 2, stepIndex: nav.stepIndex, activeTab: 1 })
          }
          activeTab={nav.activeTab}
          onTabChange={(t) => setNav({ ...nav, activeTab: t })}
          onDeleteBlock={deleteBlock}
        />
      );
    }

    return null;
  };

  const [isMobilePreview, setIsMobilePreview] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        gap: "1.25rem",
        alignItems: "flex-start",
      }}
    >
      {/* Sidebar — fixed width so it never shifts between levels */}
      <div
        className="sar-visual-editor-sidebar"
        style={{
          flex: "0 0 320px",
          width: 320,
          minWidth: 240,
          maxWidth: 360,
        }}
      >
        <Card>
          <BlockStack gap="300">{renderSidebar()}</BlockStack>
        </Card>
      </div>

      {/* Aperçu 70% */}
      <div style={{ flex: "1 1 0", minWidth: 280 }}>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack>
                <Text as="h2" variant="headingMd">
                  Aperçu boutique
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Rendu simplifié — cliquez sur un élément pour le modifier.
                </Text>
              </BlockStack>
              <InlineStack gap="100">
                <Button
                  pressed={!isMobilePreview}
                  onClick={() => setIsMobilePreview(false)}
                >
                  Bureau
                </Button>
                <Button
                  pressed={isMobilePreview}
                  onClick={() => setIsMobilePreview(true)}
                >
                  Mobile
                </Button>
              </InlineStack>
            </InlineStack>
            <BundleIframePreview
              form={form}
              activeStepIndex={activeStepIndex}
              selectedBlockId={nav.level === 3 ? nav.blockId : null}
              isMobile={isMobilePreview}
              onSelectStep={(idx) =>
                setNav({ level: 2, stepIndex: idx, activeTab: 0 })
              }
              onSelectBlock={(blockId) => {
                if (blockId) {
                  setNav({
                    level: 3,
                    stepIndex: activeStepIndex,
                    blockId,
                    activeTab: 0,
                  });
                } else {
                  setNav({ level: 1 });
                }
              }}
            />
            {currentStep ? (
              <Text as="p" variant="bodySm" tone="subdued">
                Étape affichée :{" "}
                <strong>
                  {currentStep.name.trim() || `Étape ${activeStepIndex + 1}`}
                </strong>{" "}
                — {productCount} produit(s).
              </Text>
            ) : null}
          </BlockStack>
        </Card>
      </div>
    </div>
  );
}

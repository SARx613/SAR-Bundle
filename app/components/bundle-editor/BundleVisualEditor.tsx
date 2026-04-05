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
  Text,
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
import { BundleStorefrontPreview } from "./BundleStorefrontPreview";
import { SidebarLevel2 } from "./SidebarLevel2";
import { SidebarLevel3 } from "./SidebarLevel3";
import {
  emptyStep,
  type BundleFormState,
  type UiStep,
} from "../../utils/bundle-form.client";
import type { StorefrontDesignV2 } from "../../utils/storefront-design";

type SidebarLevel =
  | { level: 1 }
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
  // Lifted from SidebarLevel2 so it can be shared with the preview
  const [hiddenBlocks, setHiddenBlocks] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (nav.level !== 1) {
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

  const patchDesign = useCallback(
    (next: StorefrontDesignV2) => {
      setForm((f) => ({ ...f, storefrontDesign: next }));
    },
    [setForm],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      setForm((f) => ({
        ...f,
        storefrontDesign: {
          ...f.storefrontDesign,
          version: 2,
          blocks: f.storefrontDesign.blocks.filter((b) => b.id !== blockId),
        },
      }));
      // Remove from hidden set if present
      setHiddenBlocks((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
      setNav((n) =>
        n.level === 3 ? { level: 2, stepIndex: n.stepIndex, activeTab: 0 } : n,
      );
    },
    [setForm],
  );

  const toggleBlockVisibility = useCallback((blockId: string) => {
    setHiddenBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  const addStep = () => {
    setForm((f) => ({ ...f, steps: [...f.steps, emptyStep(f.steps.length)] }));
  };

  const deleteStep = (i: number) => {
    setForm((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }));
    setNav((n) => {
      if (n.level === 1) return n;
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
      if (n.level === 1) return n;
      if (n.stepIndex === oldIndex) return { ...n, stepIndex: newIndex };
      return n;
    });
  };

  const activeStepIndex = nav.level === 1 ? 0 : nav.stepIndex;
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
        </BlockStack>
      );
    }

    if (nav.level === 2) {
      const step = form.steps[nav.stepIndex];
      if (!step) {
        setNav({ level: 1 });
        return null;
      }
      return (
        <SidebarLevel2
          stepIndex={nav.stepIndex}
          step={step}
          stepsCount={form.steps.length}
          design={form.storefrontDesign}
          onDesignChange={patchDesign}
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
          hiddenBlocks={hiddenBlocks}
          onToggleBlockVisibility={toggleBlockVisibility}
        />
      );
    }

    if (nav.level === 3) {
      const step = form.steps[nav.stepIndex];
      const stepName = step?.name.trim() || `Étape ${nav.stepIndex + 1}`;
      return (
        <SidebarLevel3
          blockId={nav.blockId}
          stepName={stepName}
          stepIndex={nav.stepIndex}
          step={step}
          design={form.storefrontDesign}
          onDesignChange={patchDesign}
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
      {/* Sidebar 30% */}
      <div
        style={{
          flex: "0 0 30%",
          width: "30%",
          minWidth: 240,
          maxWidth: 340,
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
            <div
              style={{
                width: isMobilePreview ? "375px" : "100%",
                margin: "0 auto",
                transition: "width 0.2s ease",
                border: isMobilePreview ? "1px solid var(--p-color-border)" : "none",
                borderRadius: isMobilePreview ? 16 : 0,
                padding: isMobilePreview ? 10 : 0,
                boxShadow: isMobilePreview ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <BundleStorefrontPreview
                design={form.storefrontDesign}
                steps={form.steps}
                activeStepIndex={activeStepIndex}
                selectedBlockId={nav.level === 3 ? nav.blockId : null}
                hiddenBlocks={hiddenBlocks}
                isMobile={isMobilePreview}
                onSelectStep={(idx) =>
                  setNav({ level: 2, stepIndex: idx, activeTab: 0 })
                }
                onSelectBlock={(blockId) =>
                  setNav({
                    level: 3,
                    stepIndex: activeStepIndex,
                    blockId,
                    activeTab: 0,
                  })
                }
              />
            </div>
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

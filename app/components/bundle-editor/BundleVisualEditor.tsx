import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
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
import { ArrowDownIcon, ArrowUpIcon, DragHandleIcon } from "@shopify/polaris-icons";
import { BundleStorefrontBlocksEditor } from "./BundleStorefrontBlocksEditor";
import { BundleStorefrontPreview } from "./BundleStorefrontPreview";
import type { BundleFormState } from "../../utils/bundle-form.client";

function SortableStepRow({
  id,
  index,
  label,
  selected,
  onSelect,
  onMove,
  total,
}: {
  id: string;
  index: number;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onMove: (delta: number) => void;
  total: number;
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
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Box
        padding="200"
        background={selected ? "bg-fill-secondary" : undefined}
        borderWidth="025"
        borderColor="border"
        borderRadius="200"
      >
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <button
            type="button"
            aria-label="Glisser pour réordonner"
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <Button variant="plain" onClick={onSelect}>
              <Text as="span" variant="bodySm" truncate>
                {label}
              </Text>
            </Button>
          </div>
          <Button
            icon={ArrowUpIcon}
            variant="plain"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            accessibilityLabel="Monter l’étape"
          />
          <Button
            icon={ArrowDownIcon}
            variant="plain"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            accessibilityLabel="Descendre l’étape"
          />
        </InlineStack>
      </Box>
    </div>
  );
}

export function BundleVisualEditor({
  form,
  setForm,
  onOpenStepsTab,
}: {
  form: BundleFormState;
  setForm: Dispatch<SetStateAction<BundleFormState>>;
  onOpenStepsTab: () => void;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    setActiveStepIndex((i) =>
      form.steps.length === 0 ? 0 : Math.min(i, form.steps.length - 1),
    );
  }, [form.steps.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const moveStep = (index: number, delta: number) => {
    const j = index + delta;
    setForm((f) => {
      const steps = [...f.steps];
      if (j < 0 || j >= steps.length) return f;
      const a = steps[index];
      const b = steps[j];
      if (!a || !b) return f;
      steps[index] = b;
      steps[j] = a;
      return {
        ...f,
        steps: steps.map((s, si) => ({ ...s, sortOrder: si })),
      };
    });
    setActiveStepIndex((i) => {
      if (i === index) return j;
      if (i === j) return index;
      return i;
    });
  };

  const parseStepSortableId = (id: string | number) => {
    const m = String(id).match(/^step-(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };

  const onStepsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = parseStepSortableId(active.id);
    const newIndex = parseStepSortableId(over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
    setForm((f) => {
      const next = arrayMove(f.steps, oldIndex, newIndex).map((s, si) => ({
        ...s,
        sortOrder: si,
      }));
      return { ...f, steps: next };
    });
    setActiveStepIndex((i) => {
      if (i === oldIndex) return newIndex;
      if (oldIndex < newIndex && i > oldIndex && i <= newIndex) return i - 1;
      if (oldIndex > newIndex && i >= newIndex && i < oldIndex) return i + 1;
      return i;
    });
  };

  const stepIds = form.steps.map((_, i) => `step-${i}`);
  const currentStep = form.steps[activeStepIndex];
  const productCount = currentStep?.products.length ?? 0;

  return (
    <div
      style={{
        display: "flex",
        gap: "1.25rem",
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          flex: "1 1 280px",
          maxWidth: "100%",
          width: "35%",
          minWidth: 260,
        }}
      >
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Étapes
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Réordonnez les étapes (glisser ou flèches). La zone de droite
              montre l’aperçu pour l’étape sélectionnée.
            </Text>
            {form.steps.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">
                Ajoutez des étapes dans l’onglet « Étapes & produits ».
              </Text>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onStepsDragEnd}
              >
                <SortableContext
                  items={stepIds}
                  strategy={verticalListSortingStrategy}
                >
                  <BlockStack gap="200">
                    {form.steps.map((s, i) => (
                      <SortableStepRow
                        key={`step-${i}-${s.sortOrder}`}
                        id={`step-${i}`}
                        index={i}
                        label={s.name.trim() || `Étape ${i + 1}`}
                        selected={i === activeStepIndex}
                        onSelect={() => setActiveStepIndex(i)}
                        onMove={(d) => moveStep(i, d)}
                        total={form.steps.length}
                      />
                    ))}
                  </BlockStack>
                </SortableContext>
              </DndContext>
            )}

            <Button onClick={onOpenStepsTab} variant="secondary">
              Ouvrir « Étapes & produits »
            </Button>

            <Text as="h3" variant="headingSm">
              Blocs au-dessus du tunnel
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Titres, hero, bannière split, grille produits (v2), etc. — même
              contenu pour toutes les étapes.
            </Text>
            <BundleStorefrontBlocksEditor
              design={form.storefrontDesign}
              onChange={(d) =>
                setForm((f) => ({ ...f, storefrontDesign: d }))
              }
            />
          </BlockStack>
        </Card>
      </div>

      <div style={{ flex: "1 1 400px", width: "65%", minWidth: 280 }}>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Aperçu boutique
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Rendu simplifié (sélection fictive). Le widget en ligne reprend
              la même structure.
            </Text>
            <BundleStorefrontPreview
              design={form.storefrontDesign}
              steps={form.steps}
              activeStepIndex={activeStepIndex}
              bundleTitle={form.name}
            />
            {currentStep ? (
              <Text as="p" variant="bodySm" tone="subdued">
                Étape sélectionnée :{" "}
                <strong>
                  {currentStep.name.trim() || `Étape ${activeStepIndex + 1}`}
                </strong>{" "}
                — {productCount} produit(s).{" "}
                <Button variant="plain" onClick={onOpenStepsTab}>
                  Modifier
                </Button>
              </Text>
            ) : null}
          </BlockStack>
        </Card>
      </div>
    </div>
  );
}

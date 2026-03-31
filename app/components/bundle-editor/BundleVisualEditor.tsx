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
  Divider,
  Text,
} from "@shopify/polaris";
import { BundleStorefrontPreview } from "./BundleStorefrontPreview";
import { SidebarLevel2 } from "./SidebarLevel2";
import { SidebarLevel3 } from "./SidebarLevel3";
import type { BundleFormState, UiStep } from "../../utils/bundle-form.client";
import type { StorefrontDesignV2 } from "../../utils/storefront-design";

type SidebarLevel =
  | { level: 1 }
  | { level: 2; stepIndex: number; activeTab: number }
  | { level: 3; stepIndex: number; blockId: string; activeTab: number };

export function BundleVisualEditor({
  form,
  setForm,
  onOpenStepsTab,
}: {
  form: BundleFormState;
  setForm: Dispatch<SetStateAction<BundleFormState>>;
  onOpenStepsTab: () => void;
}) {
  const [nav, setNav] = useState<SidebarLevel>({ level: 1 });

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
      setNav((n) => (n.level === 3 ? { level: 2, stepIndex: n.stepIndex, activeTab: 0 } : n));
    },
    [setForm],
  );

  const activeStepIndex =
    nav.level === 1 ? 0 : nav.stepIndex;

  const currentStep = form.steps[activeStepIndex];
  const productCount = currentStep?.products.length ?? 0;

  const renderSidebar = () => {
    if (nav.level === 1) {
      return (
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Étapes
          </Text>
          {form.steps.length === 0 ? (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <Text as="p" variant="bodySm" tone="subdued">
                Aucune étape. Cliquez sur "Ouvrir Étapes & produits" pour en
                ajouter.
              </Text>
            </Box>
          ) : (
            <BlockStack gap="150">
              {form.steps.map((s, i) => (
                <Box
                  key={i}
                  padding="200"
                  borderWidth="025"
                  borderColor="border"
                  borderRadius="200"
                >
                  <Button
                    variant="plain"
                    onClick={() =>
                      setNav({ level: 2, stepIndex: i, activeTab: 0 })
                    }
                    fullWidth
                    textAlign="left"
                  >
                    <Text as="span" variant="bodySm">
                      {s.name.trim() || `Étape ${i + 1}`}
                    </Text>
                  </Button>
                </Box>
              ))}
            </BlockStack>
          )}
          <Divider />
          <Button variant="secondary" onClick={onOpenStepsTab}>
            Ouvrir « Étapes & produits »
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
          design={form.storefrontDesign}
          onDesignChange={patchDesign}
          onStepPatch={(patch) => patchStep(nav.stepIndex, patch)}
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
          onTabChange={(t) =>
            setNav({ ...nav, activeTab: t })
          }
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
          design={form.storefrontDesign}
          onDesignChange={patchDesign}
          onBack={() =>
            setNav({ level: 2, stepIndex: nav.stepIndex, activeTab: 0 })
          }
          activeTab={nav.activeTab}
          onTabChange={(t) => setNav({ ...nav, activeTab: t })}
          onDeleteBlock={deleteBlock}
        />
      );
    }

    return null;
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "1.25rem",
        alignItems: "flex-start",
      }}
    >
      {/* Sidebar 30% — fixe, remplace son contenu selon le niveau */}
      <div
        style={{
          flex: "0 0 30%",
          width: "30%",
          minWidth: 240,
          maxWidth: 340,
        }}
      >
        <Card>
          <BlockStack gap="300">
            {renderSidebar()}
          </BlockStack>
        </Card>
      </div>

      {/* Aperçu 70% — toujours visible, ne bouge jamais */}
      <div style={{ flex: "1 1 0", minWidth: 280 }}>
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Aperçu boutique
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Rendu simplifié — sélection fictive. Le widget reprend la même
              structure sur la boutique.
            </Text>
            <BundleStorefrontPreview
              design={form.storefrontDesign}
              steps={form.steps}
              activeStepIndex={activeStepIndex}
              bundleTitle={form.name}
            />
            {currentStep ? (
              <Text as="p" variant="bodySm" tone="subdued">
                Étape affichée :{" "}
                <strong>
                  {currentStep.name.trim() ||
                    `Étape ${activeStepIndex + 1}`}
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

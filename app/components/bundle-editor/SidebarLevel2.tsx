import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  BlockStack,
  Box,
  Button,
  Divider,
  DropZone,
  InlineStack,
  Modal,
  Select,
  Tabs,
  Text,
  TextField,
  Thumbnail,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import {
  blockDisplayLabel,
  newBlockId,
  type StorefrontDesignV2,
} from "../../utils/storefront-design";
import type { UiStep, UiStepRule } from "../../utils/bundle-form.client";

type UploadJson = {
  ok?: boolean;
  error?: string;
  imageUrl?: string | null;
  imageGid?: string | null;
};

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

export function SidebarLevel2({
  stepIndex,
  step,
  design,
  onDesignChange,
  onStepPatch,
  onBack,
  onBlockClick,
  activeTab,
  onTabChange,
}: {
  stepIndex: number;
  step: UiStep;
  design: StorefrontDesignV2;
  onDesignChange: (d: StorefrontDesignV2) => void;
  onStepPatch: (patch: Partial<UiStep>) => void;
  onBack: () => void;
  onBlockClick: (blockId: string) => void;
  activeTab: number;
  onTabChange: (t: number) => void;
}) {
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [draftRules, setDraftRules] = useState<UiStepRule[]>(step.rules);
  const uploadFetcher = useFetcher<UploadJson>();

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

  const layoutTab = (
    <BlockStack gap="300">
      <Button variant="plain" onClick={onBack}>
        ← Étapes
      </Button>
      <Text as="h3" variant="headingSm">
        Blocs de la page
      </Text>
      {design.blocks.length === 0 ? (
        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
          <Text as="p" variant="bodySm" tone="subdued">
            Aucun bloc. Utilisez le bouton ci-dessous pour ajouter une section.
          </Text>
        </Box>
      ) : (
        <BlockStack gap="150">
          {design.blocks.map((block) => (
            <Box
              key={block.id}
              padding="200"
              borderWidth="025"
              borderColor="border"
              borderRadius="200"
            >
              <Button variant="plain" onClick={() => onBlockClick(block.id)}>
                <Text as="span" variant="bodySm">
                  {blockDisplayLabel(block)}
                </Text>
              </Button>
            </Box>
          ))}
        </BlockStack>
      )}
      <Button
        onClick={() => {
          const id = newBlockId();
          onDesignChange({
            ...design,
            version: 2,
            blocks: [
              ...design.blocks,
              {
                id,
                type: "heading",
                text: "Nouveau titre",
                tag: "h2",
                style: {
                  fontSize: "1.25rem",
                  color: "var(--p-color-text)",
                  marginBottom: "0.5rem",
                },
              },
            ],
          });
        }}
      >
        + Ajouter une section
      </Button>
    </BlockStack>
  );

  const settingsTab = (
    <BlockStack gap="300">
      <Button variant="plain" onClick={onBack}>
        ← Étapes
      </Button>
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
        tabs={[
          { id: "layout", content: "Mise en page" },
          { id: "settings", content: "Paramètres" },
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


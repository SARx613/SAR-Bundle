/**
 * BundleIframePreview — Remplace BundleStorefrontPreview (React)
 *
 * Charge bundle-builder.js dans une iframe via la route /bundle-preview.
 * Synchronise l'état du formulaire admin (form) vers l'iframe via postMessage.
 * Reçoit les événements de sélection de blocs depuis l'iframe via postMessage.
 * Hauteur de l'iframe dynamique via ResizeObserver côté iframe.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { BundleFormState } from "~/utils/bundle-form.client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BundleIframePreviewProps {
  form: BundleFormState;
  activeStepIndex: number;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onSelectStep: (idx: number) => void;
  isMobile?: boolean;
}

// ─── Helper : construit la payload bundle pour bundle-builder.js ─────────────

function buildPreviewBundle(
  form: BundleFormState,
  activeStepIndex: number,
  selectedBlockId: string | null,
) {
  return {
    // Identité
    id: null, // pas d'ajout au panier en preview — id Shopify non requis
    name: form.name,
    shopifyParentVariantId: null, // pas d'ajout au panier en preview

    // Pricing
    bundlePricingMode: form.bundlePricingMode ?? "STANDARD",
    pricingScope:
      form.bundlePricingMode === "TIERED"
        ? "TIERED"
        : "FLAT",
    discountValueType:
      form.bundlePricingMode === "FIXED_PRICE_BOX"
        ? "FIXED_PRICE"
        : form.bundlePricingMode === "STANDARD"
          ? form.standardDiscountType
          : form.discountValueType,
    flatDiscountValue: form.flatDiscountValue || null,
    showCompareAtPrice: form.showCompareAtPrice ?? false,
    showFixedPriceOnLoad: form.showFixedPriceOnLoad ?? false,
    allowZeroTotal: form.allowZeroTotal ?? false,
    fixedBoxItemCount: form.fixedBoxItemCount
      ? parseInt(form.fixedBoxItemCount, 10) || null
      : null,
    pricingTiers:
      form.bundlePricingMode === "TIERED"
        ? (form.pricingTiers ?? []).map((t, i) => ({
            sortOrder: i,
            thresholdBasis: t.thresholdBasis,
            thresholdMin: t.thresholdMin,
            thresholdMax: t.thresholdMax || null,
            tierValue: t.tierValue,
          }))
        : [],

    // Design
    storefrontDesign: form.storefrontDesign,

    // Étapes — on réinjecte les données storefront enrichies (prix, images)
    steps: form.steps.map((step, si) => ({
      sortOrder: si,
      name: step.name || null,
      description: step.description || null,
      isFinalStep: step.isFinalStep,
      stepDesign: step.stepDesign ?? null,
      products: step.products.map((p, pi) => ({
        variantGid: p.variantGid,
        sortOrder: pi,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
        productHandle: p.productHandle ?? null,
        layoutPreset: p.layoutPreset,
        styleOverrides: p.styleOverrides,
        // Enrichissement storefront → bundle-builder.js les utilise directement
        // (via applyStorefrontEnrichment) sans fetch /variants/:id.js
        storefront: {
          displayTitle: p.displayName,
          productTitle: p.displayName,
          imageUrl: p.imageUrl ?? null,
          priceAmount: p.priceAmount ?? null,
          currencyCode: p.currencyCode ?? null,
          productHandle: p.productHandle ?? null,
        },
      })),
      rules: step.rules.map((r, ri) => ({
        sortOrder: ri,
        metric: r.metric,
        operator: r.operator,
        value: r.value,
        targetVariantGid:
          r.metric === "VARIANT_QUANTITY" && r.targetVariantGid?.trim()
            ? r.targetVariantGid.trim()
            : null,
      })),
      lineItemProperties: step.lineItemProperties.map((lp, li) => ({
        sortOrder: li,
        fieldType: lp.fieldType,
        label: lp.label,
        propertyKey: lp.propertyKey,
        required: lp.required,
        defaultChecked: lp.defaultChecked,
        placeholder: lp.placeholder || null,
      })),
    })),

    // Flags éditeur (lus par bundle-builder.js)
    __editorMode: true,
    __selectedBlockId: selectedBlockId,
    stepIndex: activeStepIndex,
  };
}

// ─── Composant ───────────────────────────────────────────────────────────────

export function BundleIframePreview({
  form,
  activeStepIndex,
  selectedBlockId,
  onSelectBlock,
  isMobile = false,
}: BundleIframePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReadyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [iframeHeight, setIframeHeight] = useState(600);

  // Envoie la bundle data à l'iframe
  const sendUpdate = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !iframeReadyRef.current) return;
    const bundle = buildPreviewBundle(form, activeStepIndex, selectedBlockId);
    iframe.contentWindow.postMessage(
      { type: "sar-preview-update", bundle, stepIndex: activeStepIndex, selectedBlockId },
      "*",
    );
  }, [form, activeStepIndex, selectedBlockId]);

  // Écoute les messages en provenance de l'iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data) return;

      switch (e.data.type) {
        case "sar-preview-ready":
          iframeReadyRef.current = true;
          sendUpdate(); // Premier envoi dès que l'iframe est prête
          break;

        case "sar-editor-select-block":
          onSelectBlock(e.data.blockId ?? null);
          break;

        case "sar-preview-height":
          if (typeof e.data.height === "number" && e.data.height > 0) {
            // +16 pour le padding body de l'iframe
            setIframeHeight(Math.max(400, e.data.height + 16));
          }
          break;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendUpdate, onSelectBlock]);

  // Debounce des mises à jour lors de chaque changement du formulaire
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (iframeReadyRef.current) sendUpdate();
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [form, activeStepIndex, selectedBlockId, sendUpdate]);

  // Reset iframeReady quand le src change (rechargement)
  const handleLoad = useCallback(() => {
    // L'iframe émettra sar-preview-ready elle-même
    iframeReadyRef.current = false;
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isMobile ? "390px" : "100%",
        margin: "0 auto",
        transition: "max-width 0.25s ease",
        overflow: "hidden",
      }}
    >
      <iframe
        ref={iframeRef}
        src="/bundle-preview"
        title="Aperçu bundle (storefront)"
        onLoad={handleLoad}
        style={{
          width: "100%",
          height: `${iframeHeight}px`,
          border: "none",
          display: "block",
          transition: "height 0.2s ease",
        }}
        // Permissions nécessaires pour le rendu correct
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

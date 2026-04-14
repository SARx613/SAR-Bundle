/**
 * BundleIframePreview — Aperçu storefront 100% fidèle via bundle-builder.js dans un iframe.
 *
 * Communication :
 *   Admin → iframe  : sar-preview-update  (données bundle)
 *   Admin → iframe  : sar-preview-hover-block  (survol sidebar → bordure bleue)
 *   iframe → Admin  : sar-editor-select-block  (clic bloc → sélection sidebar)
 *   iframe → Admin  : sar-preview-height  (hauteur dynamique)
 *   iframe → Admin  : sar-preview-ready  (prêt à recevoir données)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { BundleFormState } from "~/utils/bundle-form.client";

interface BundleIframePreviewProps {
  form: BundleFormState;
  activeStepIndex: number;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onSelectStep: (idx: number) => void;
  isMobile?: boolean;
}

// ─── Helper : payload bundle → bundle-builder.js ────────────────────────────

function buildPreviewBundle(
  form: BundleFormState,
  activeStepIndex: number,
  selectedBlockId: string | null,
) {
  const pricingScope = form.bundlePricingMode === "TIERED" ? "TIERED" : "FLAT";
  const discountValueType =
    form.bundlePricingMode === "FIXED_PRICE_BOX"
      ? "FIXED_PRICE"
      : form.bundlePricingMode === "STANDARD"
        ? form.standardDiscountType
        : form.discountValueType;

  return {
    id: null, // pas d'ajout au panier en preview
    name: form.name,
    shopifyParentVariantId: null,
    bundlePricingMode: form.bundlePricingMode ?? "STANDARD",
    pricingScope,
    discountValueType,
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
    storefrontDesign: form.storefrontDesign,
    steps: form.steps.map((step, si) => ({
      sortOrder: si,
      name: step.name || null,
      description: step.description || null,
      isFinalStep: step.isFinalStep,
      imageUrl: step.imageUrl,
      stepDesign: step.stepDesign ?? null,
      products: step.products.map((p, pi) => ({
        variantGid: p.variantGid,
        sortOrder: pi,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
        productHandle: p.productHandle ?? null,
        layoutPreset: p.layoutPreset,
        styleOverrides: p.styleOverrides,
        // Enrichissement storefront déjà disponible dans UiStepProduct
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [iframeHeight, setIframeHeight] = useState(400);

  // Envoie la bundle data à l'iframe
  const sendUpdate = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const bundle = buildPreviewBundle(form, activeStepIndex, selectedBlockId);
    iframe.contentWindow.postMessage(
      { type: "sar-preview-update", bundle, stepIndex: activeStepIndex, selectedBlockId },
      "*",
    );
  }, [form, activeStepIndex, selectedBlockId]);

  // Dès que l'iframe est chargée, on envoie les données (après 200ms pour laisser les scripts démarrer)
  const handleLoad = useCallback(() => {
    // Court délai pour laisser bundle-builder.js s'initialiser
    setTimeout(() => sendUpdate(), 200);
  }, [sendUpdate]);

  // Écoute les messages de l'iframe et les événements hover de la sidebar
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data) return;
      switch (e.data.type) {
        case "sar-preview-ready":
          // L'iframe signale qu'elle est prête → envoyer immédiatement
          sendUpdate();
          break;
        case "sar-editor-select-block":
          onSelectBlock(e.data.blockId ?? null);
          break;
        case "sar-preview-height":
          if (typeof e.data.height === "number" && e.data.height > 0) {
            setIframeHeight(Math.max(300, e.data.height + 32));
          }
          break;
      }
    }

    // Hover sidebar → iframe : relayé via window custom event (pas de prop drilling)
    function handleAdminHover(e: Event) {
      const blockId = (e as CustomEvent<string | null>).detail;
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage({ type: "sar-preview-hover-block", blockId }, "*");
    }

    window.addEventListener("message", handleMessage);
    window.addEventListener("sar-admin-hover-block", handleAdminHover);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("sar-admin-hover-block", handleAdminHover);
    };
  }, [sendUpdate, onSelectBlock]);

  // Debounce 50ms : met à jour l'aperçu dès que form/step/block changent
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(sendUpdate, 50);
    return () => clearTimeout(debounceRef.current);
  }, [form, activeStepIndex, selectedBlockId, sendUpdate]);

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
          transition: "height 0.15s ease",
        }}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

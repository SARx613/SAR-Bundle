import { useEffect, useRef } from "react";
import type { StorefrontDesignV2 } from "../../utils/storefront-design";
import type { UiStep } from "../../utils/bundle-form.client";

declare global {
  interface Window {
    SARBundleJS?: {
      mount: (el: HTMLElement, explicitBundleData?: any) => Promise<void>;
      init: () => void;
    };
  }
}

export function BundleStorefrontPreview({
  design,
  steps,
  activeStepIndex,
  onSelectStep,
  onSelectBlock,
  selectedBlockId,
  hiddenBlocks,
  isMobile,
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  onSelectStep: (idx: number) => void;
  onSelectBlock: (id: string | null) => void;
  selectedBlockId: string | null;
  hiddenBlocks?: Record<string, boolean>;
  isMobile?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Remonte le composant avec SARBundleJS nativement (ce qui garantit 100% de parité avec la vitrine Shopify)
  useEffect(() => {
    if (!mountRef.current || !window.SARBundleJS) return;
    
    // Pass the actual JS structure format
    const bundleData = {
       steps: steps,
       stepIndex: activeStepIndex,
       storefrontDesign: design,
       __editorMode: true,
       __selectedBlockId: selectedBlockId
    };

    mountRef.current.innerHTML = `<div data-sar-loading></div><div data-sar-inner></div>`;
    
    window.SARBundleJS.mount(mountRef.current, bundleData).catch(console.error);

  }, [design, steps, activeStepIndex, selectedBlockId, isMobile]);

  // Écoute les clics sur les blocks interactifs poussés par le vanilla JS
  useEffect(() => {
    const handleSelect = (e: any) => {
      if (e.detail) {
        onSelectBlock(e.detail);
      }
    };
    window.addEventListener('sar-editor-select-block', handleSelect);
    return () => window.removeEventListener('sar-editor-select-block', handleSelect);
  }, [onSelectBlock]);

  return (
    <div
      style={{
        position: "relative",
        background: design.global?.pageBackground || "transparent",
        fontFamily: design.global?.fontBody || "inherit",
        minHeight: "100%",
        padding: "1rem",
        // En mode mobile de l'éditeur, on force les variables pour qu'elles écrasent --grid-cols-desktop
        ...(isMobile ? { '--grid-cols-desktop': 'var(--grid-cols-mobile, 2)' } : {})
      } as React.CSSProperties}
    >
      <div 
        ref={mountRef} 
        id="sar-bundle-root"
        data-heading="Composez votre pack"
        data-show-progress="true"
      />
    </div>
  );
}

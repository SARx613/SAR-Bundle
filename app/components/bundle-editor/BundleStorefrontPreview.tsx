import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  StepBarBlock,
  ProductListBlock,
  UpsellBlock,
  StorefrontBlockV2,
  StorefrontDesignV2,
  TextStyleBlock,
} from "../../utils/storefront-design";
import { blockDisplayLabel } from "../../utils/storefront-design";
import type { UiStep, UiStepProduct } from "../../utils/bundle-form.client";

/* ─────────────────── helpers ─────────────────── */

function textStyleToCss(st: TextStyleBlock | undefined): CSSProperties {
  if (!st) return {};
  return {
    fontSize: st.fontSize,
    fontWeight: st.fontWeight,
    color: st.color,
    backgroundColor: st.backgroundColor,
    textAlign: st.textAlign,
    marginTop: st.marginTop,
    marginBottom: st.marginBottom,
    padding: st.padding,
    borderRadius: st.borderRadius,
    borderWidth: st.borderWidth,
    borderColor: st.borderColor,
    borderStyle: st.borderWidth ? "solid" : undefined,
    fontFamily: st.fontFamily,
  };
}

/* ─────────────────── Interactive wrapper ─────────────────── */

function InteractiveBlockWrapper({
  blockId,
  blockName,
  selectedBlockId,
  onSelectBlock,
  children,
}: {
  blockId: string;
  blockName: string;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const isSelected = blockId === selectedBlockId;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectBlock(blockId);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        boxShadow: isSelected
          ? "inset 0 0 0 2px var(--p-color-border-interactive)"
          : hovered
            ? "inset 0 0 0 2px var(--p-color-border-interactive-hover, rgba(0,91,211,0.4))"
            : "inset 0 0 0 2px transparent",
        borderRadius: 6,
        cursor: "pointer",
        transition: "box-shadow 0.15s ease",
        padding: 2,
      }}
    >
      {children}
      {(hovered || isSelected) && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 4,
            background: isSelected
              ? "var(--p-color-bg-fill-brand)"
              : "var(--p-color-bg-surface-secondary)",
            color: isSelected ? "#fff" : "var(--p-color-text-subdued)",
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: 4,
            fontWeight: 600,
            lineHeight: "16px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {blockName}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Step Bar Preview ─────────────────── */

function StepBarPreview({
  block,
  steps,
  activeStepIndex,
  onSelectStep,
}: {
  block: StepBarBlock;
  steps: UiStep[];
  activeStepIndex: number;
  onSelectStep: (i: number) => void;
}) {
  const st = block.style ?? {};

  return (
    <div
      className="sar-stepbar"
      style={{
        "--sar-stepbar-borderColor": st.borderColor || "transparent",
        "--sar-stepbar-lineColor": st.lineColor || st.borderColor || "#e1e3e5",
        "--sar-stepbar-active-bg": st.activeBg || "#555555",
        "--sar-stepbar-completed-bg": st.completedBg || st.activeBg || "#555555",
        "--sar-stepbar-inactive-bg": st.inactiveBg || "#f1f1f1",
        "--sar-stepbar-active-text": st.activeTextColor || "#ffffff",
        "--sar-stepbar-inactive-text": st.inactiveTextColor || "#999999",
        "--sar-stepbar-label-color": st.labelColor || "#666",
        "--sar-stepbar-font-size": st.fontSize || "12px",
        cursor: "pointer",
      } as any}
    >
      {steps.map((s, i) => {
        const isActive = i === activeStepIndex;
        const isCompleted = i < activeStepIndex;
        const isShowLine = st.showLine !== false;

        return (
          <div
            key={i}
            className={`sar-stepbar__item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
            onClick={() => onSelectStep(i)}
          >
            {i < steps.length - 1 && isShowLine && (
              <div className="sar-stepbar__line" />
            )}

            <div className="sar-stepbar__icon-circle">
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>

            <div className="sar-stepbar__label">
              {(s.name || `Étape ${i + 1}`).slice(0, 24)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── Product Grid Preview ─────────────────── */

function ProductGridPreview({
  block,
  products,
  isMobile,
  pricingMode,
}: {
  block: ProductListBlock | null;
  products: UiStepProduct[];
  isMobile?: boolean;
  pricingMode?: string;
}) {
  const cols = block?.columns ?? 3;
  const colsMobile = block?.columnsMobile ?? 2;
  const cardLayout = block?.cardLayout ?? "classic";
  const buttonText = block?.buttonText || "Add to box";
  const showPrice = pricingMode !== "FIXED_PRICE_BOX";

  const containerStyle: React.CSSProperties = {
    "--grid-cols-desktop": cols,
    "--grid-cols-mobile": colsMobile,
    "--grid-gap-x": "16px",
    "--grid-gap-y": "16px",
    gridTemplateColumns: `repeat(${isMobile ? colsMobile : cols}, 1fr)`,
  } as any;
  if (block?.buttonBackground) containerStyle["--sar-color-primary"] = block.buttonBackground;
  if (block?.buttonColor) containerStyle["--sar-button-text"] = block.buttonColor;
  if (block?.titleColor) containerStyle["--sar-product-title-color"] = block.titleColor;
  if (block?.priceColor) containerStyle["--sar-product-price-color"] = block.priceColor;

  if (products.length === 0) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "var(--p-color-text-subdued, #999)",
          border: "2px dashed var(--p-color-border, #e1e3e5)",
          borderRadius: 8,
        }}
      >
        Aucun produit dans cette étape. Ajoutez des produits via l'onglet Paramètres.
      </div>
    );
  }

  const effectiveCols = isMobile ? colsMobile : cols;

  return (
    <div
      className="sar-bundle__products"
      style={{
        ...containerStyle,
        gridTemplateColumns: `repeat(${effectiveCols}, 1fr)`,
      } as any}
    >
      {products.map((p) => (
        <ProductCard
          key={p.variantGid}
          product={p}
          layout={cardLayout}
          buttonText={buttonText}
          showPrice={showPrice}
        />
      ))}
    </div>
  );
}

/* ─────────────────── Upsell Preview (Order Bump) ─────────────────── */

function UpsellPreview({
  block,
}: {
  block: UpsellBlock;
}) {
  const behavior = block.behavior ?? "multiple";
  const items = block.items ?? [];
  const [selectedIds, setSelectedIds] = useState<string[]>(
    items.filter((it: any) => it.defaultEnabled).map((it: any) => it.id)
  );

  const toggle = (id: string) => {
    if (behavior === "single") {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev: string[]) =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    }
  };

  return (
    <div className="sar-bundle__upsell" style={{
      margin: "24px 0",
      padding: "20px",
      background: "#fff",
      border: "1px solid #e1e3e5",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
    }}>
      <div style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "700" }}>
        {block.title || "Options Supplémentaires"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((item: any) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                borderRadius: "8px",
                border: `1px solid ${isSelected ? "var(--sar-color-primary, #72cff7)" : "#e1e3e5"}`,
                background: isSelected ? "var(--sar-color-bg-subtle, #f0f7f5)" : "transparent",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <div style={{
                width: "20px",
                height: "20px",
                borderRadius: behavior === "single" ? "50%" : "4px",
                border: `2px solid ${isSelected ? "var(--sar-color-primary, #72cff7)" : "#d1d3d5"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isSelected ? "var(--sar-color-primary, #72cff7)" : "#fff"
              }}>
                {isSelected && (
                  <div style={{
                    width: behavior === "single" ? "8px" : "10px",
                    height: behavior === "single" ? "8px" : "10px",
                    borderRadius: behavior === "single" ? "50%" : "2px",
                    background: "#fff"
                  }} />
                )}
              </div>

              {item.defaultImageUrl && (
                <img
                  src={item.defaultImageUrl}
                  alt=""
                  style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "4px" }}
                />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>
                  {item.overrideLabel || item.productTitle}
                </div>
                {item.shortDescription && (
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                    {item.shortDescription}
                  </div>
                )}
              </div>

              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--sar-color-primary, #72cff7)" }}>
                +{item.priceAmount} {item.currencyCode}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  layout,
  buttonText,
  showPrice,
}: {
  product: UiStepProduct;
  layout: "classic" | "overlay";
  buttonText: string;
  showPrice?: boolean;
}) {
  const [qty, setQty] = useState(0);

  const priceEl = showPrice ? (
    <p className="sar-bundle__product-price" style={{ opacity: 0.45, fontStyle: "italic" }}>
      Prix produit
    </p>
  ) : null;

  return (
    <div className={`sar-bundle__product sar-bundle__product--${layout}`}>
      <div className="sar-bundle__product-img-wrapper">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" />
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "1",
              background: "var(--sar-color-bg-subtle, #f6f6f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "0.8rem",
            }}
          >
            📷
          </div>
        )}
        {layout === "overlay" && (
          <div className={`sar-bundle__product-atc-wrapper${qty > 0 ? " is-added" : ""}`}>
            {qty > 0 ? (
              <div className="sar-bundle__product-qty-box">
                <button type="button" className="sar-bundle__product-qty-btn" onClick={() => setQty(Math.max(0, qty - 1))}>−</button>
                <span className="sar-bundle__product-qty-val">{qty}</span>
                <button type="button" className="sar-bundle__product-qty-btn" onClick={() => setQty(qty + 1)}>+</button>
              </div>
            ) : (
              <button type="button" className="sar-bundle__product-atc-btn" onClick={() => setQty(1)}>
                {buttonText}
              </button>
            )}
          </div>
        )}
      </div>
      <p className="sar-bundle__product-title">{product.displayName || "Produit"}</p>
      {priceEl}
      {layout === "classic" && (
        <div className="sar-bundle__product-atc-wrapper">
          {qty > 0 ? (
            <div className="sar-bundle__product-qty-box">
              <button type="button" className="sar-bundle__product-qty-btn" onClick={() => setQty(Math.max(0, qty - 1))}>−</button>
              <span className="sar-bundle__product-qty-val">{qty}</span>
              <button type="button" className="sar-bundle__product-qty-btn" onClick={() => setQty(qty + 1)}>+</button>
            </div>
          ) : (
            <button type="button" className="sar-bundle__product-atc-btn" onClick={() => setQty(1)}>
              {buttonText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Block renderer ─────────────────── */

function RenderBlock({
  block,
  selectedBlockId,
  onSelectBlock,
  steps,
  activeStepIndex,
  onSelectStep,
  isMobile,
  pricingMode,
}: {
  block: StorefrontBlockV2;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  steps: UiStep[];
  activeStepIndex: number;
  onSelectStep: (i: number) => void;
  isMobile?: boolean;
  pricingMode?: string;
}) {
  const name = blockDisplayLabel(block);
  let content: React.ReactNode = null;

  switch (block.type) {
    case "heading": {
      const Tag = block.tag;
      content = <Tag style={textStyleToCss(block.style)}>{block.text}</Tag>;
      break;
    }
    case "text":
      content = <p style={textStyleToCss(block.style)}>{block.text}</p>;
      break;
    case "image":
      content = block.url ? (
        <img
          src={block.url}
          alt={block.alt}
          loading="lazy"
          style={{
            display: "block",
            maxWidth: block.style.maxWidth || "100%",
            ...textStyleToCss(block.style),
          }}
        />
      ) : (
        <div
          style={{
            background: "var(--p-color-bg-surface-secondary)",
            border: "2px dashed var(--p-color-border)",
            borderRadius: 8,
            height: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--p-color-text-subdued)",
            fontSize: "0.85rem",
          }}
        >
          🖼️ Image (non définie)
        </div>
      );
      break;
    case "spacer":
      content = (
        <div
          style={{
            height: block.height || 16,
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 5px, var(--p-color-bg-surface-secondary) 5px, var(--p-color-bg-surface-secondary) 10px)",
            borderRadius: 4,
            opacity: 0.25,
            minHeight: 4,
          }}
        />
      );
      break;
    case "hero": {
      const layout = block.layout ?? "stack";
      content = (
        <section className={`sar-bundle__hero sar-bundle__hero--${layout}`}>
          {block.imageUrl ? (
            <img src={block.imageUrl} alt="" loading="lazy" className="sar-bundle__hero-img" />
          ) : (
            <div style={{ width: 320, height: 200, background: "var(--p-color-bg-surface-secondary)", border: "2px dashed var(--p-color-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--p-color-text-subdued)", fontSize: "0.85rem" }}>
              🎯 Image Hero
            </div>
          )}
          <div className="sar-bundle__hero-text">
            <h2>{block.headline}</h2>
            {block.subtext ? <p>{block.subtext}</p> : null}
          </div>
        </section>
      );
      break;
    }
    case "split": {
      content = (
        <section className={`sar-bundle__split sar-bundle__split--img-${block.imageSide === "right" ? "right" : "left"}`}>
          {block.imageUrl ? (
            <img src={block.imageUrl} alt="" loading="lazy" className="sar-bundle__split-img" />
          ) : (
            <div style={{ width: 200, height: 140, background: "var(--p-color-bg-surface-secondary)", border: "2px dashed var(--p-color-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--p-color-text-subdued)", fontSize: "0.85rem" }}>
              🖼️ Image
            </div>
          )}
          <div className="sar-bundle__split-body">
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </div>
        </section>
      );
      break;
    }
    case "step_bar":
      content = (
        <StepBarPreview
          block={block}
          steps={steps}
          activeStepIndex={activeStepIndex}
          onSelectStep={onSelectStep}
        />
      );
      break;
    case "product_list":
      content = (
        <ProductGridPreview
          block={block}
          products={steps[activeStepIndex]?.products ?? []}
          isMobile={isMobile}
          pricingMode={pricingMode}
        />
      );
      break;
    case "upsell":
      content = <UpsellPreview block={block as UpsellBlock} />;
      break;
    default:
      return null;
  }

  return (
    <InteractiveBlockWrapper
      blockId={block.id}
      blockName={name}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
    >
      {content}
    </InteractiveBlockWrapper>
  );
}

/* ─────────────────── Main Preview Component ─────────────────── */

export function BundleStorefrontPreview({
  design,
  steps,
  activeStepIndex,
  onSelectStep,
  onSelectBlock,
  selectedBlockId,
  hiddenBlocks,
  isMobile,
  pricingMode,
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  onSelectStep: (idx: number) => void;
  onSelectBlock: (id: string | null) => void;
  selectedBlockId: string | null;
  hiddenBlocks?: Record<string, boolean>;
  isMobile?: boolean;
  pricingMode?: string;
}) {
  const visibleBlocks = useMemo(
    () => (design.blocks ?? []).filter((b) => !(hiddenBlocks ?? {})[b.id]),
    [design.blocks, hiddenBlocks],
  );

  const g = design.global ?? {};
  const step = steps[activeStepIndex];

  // Check if there is a product_list block
  const hasProductListBlock = visibleBlocks.some((b) => b.type === "product_list");

  return (
    <div
      className="sar-bundle"
      style={{
        fontFamily: g.fontBody || "inherit",
        background: g.colorBackground || g.pageBackground || "transparent",
        borderWidth: g.borderWidth ? `${g.borderWidth}px` : "1px",
        borderStyle: "solid",
        borderColor: g.colorBorder || "#e1e3e5",
        borderRadius: g.borderRadius ? `${g.borderRadius}px` : "8px",
        "--sar-color-primary": g.colorPrimary || "#555",
        "--sar-color-border": g.colorBorder || "#e1e3e5",
        "--sar-color-bg": g.colorBackground || "transparent",
        "--sar-color-bg-subtle": "#f0f0f0",
        "--sar-color-text": g.colorText || "#121212",
        "--sar-color-muted": "#6d7175",
        "--sar-radius": g.borderRadius ? `${g.borderRadius}px` : "8px",
        // Total box
        ...(g.totalBg ? { "--sar-total-bg": g.totalBg } : {}),
        ...(g.totalBorderColor ? { "--sar-total-border-color": g.totalBorderColor } : {}),
        ...(g.totalTextColor ? { "--sar-total-text-color": g.totalTextColor } : {}),
        // Nav buttons
        ...(g.btnPrimaryBg ? { "--sar-btn-primary-bg": g.btnPrimaryBg } : {}),
        ...(g.btnPrimaryColor ? { "--sar-btn-primary-color": g.btnPrimaryColor } : {}),
        ...(g.btnPrimaryHoverBg ? { "--sar-btn-primary-hover-bg": g.btnPrimaryHoverBg } : {}),
        ...(g.btnSecondaryBg ? { "--sar-btn-secondary-bg": g.btnSecondaryBg } : {}),
        ...(g.btnSecondaryColor ? { "--sar-btn-secondary-color": g.btnSecondaryColor } : {}),
        ...(g.btnSecondaryBorderColor ? { "--sar-btn-secondary-border-color": g.btnSecondaryBorderColor } : {}),
      } as React.CSSProperties}
      onClick={() => onSelectBlock(null)}
    >
      <div
        className="sar-bundle__design"
        style={{
          maxWidth: g.contentMaxWidth || "720px",
          marginBottom: "1rem",
        }}
      >
        {visibleBlocks.map((block) => (
          <RenderBlock
            key={block.id}
            block={block}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
            steps={steps}
            activeStepIndex={activeStepIndex}
            onSelectStep={onSelectStep}
            isMobile={isMobile}
            pricingMode={pricingMode}
          />
        ))}
      </div>

      {/* If no product_list block exists, show the default product grid */}
      {!hasProductListBlock && step && (
        <ProductGridPreview
          block={null}
          products={step.products}
          isMobile={isMobile}
          pricingMode={pricingMode}
        />
      )}

      {/* Footer: Total + Navigation */}
      <div className="sar-bundle__footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginTop: "1rem" }}>
        <div className="sar-bundle__bundle-total">
          <span className="sar-bundle__bundle-total-label">Total du pack</span>
          <span className="sar-bundle__bundle-total-value"><strong>0,00 €</strong></span>
        </div>
        <div className="sar-bundle__nav" style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" className="sar-bundle__btn sar-bundle__btn--secondary" style={{ flex: "1 1 0", textAlign: "center" }}>Précédent</button>
          <button type="button" className="sar-bundle__btn sar-bundle__btn--primary" style={{ flex: "1 1 0", textAlign: "center" }}>
            {activeStepIndex === steps.length - 1 ? "Ajouter au panier" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}

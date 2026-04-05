import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  StepBarBlock,
  StorefrontBlockV2,
  StorefrontDesignV2,
  TextStyleBlock,
} from "../../utils/storefront-design";
import type { UiStep, UiStepProduct } from "../../utils/bundle-form.client";

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

// Wrapper that adds interactive hover/click behavior for preview blocks
function InteractiveBlockWrapper({
  blockId,
  selectedBlockId,
  onSelectBlock,
  children,
}: {
  blockId: string;
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
        outline: isSelected
          ? "2px solid var(--p-color-border-interactive)"
          : hovered
            ? "2px dashed var(--p-color-border-interactive)"
            : "2px solid transparent",
        outlineOffset: 2,
        borderRadius: 6,
        cursor: "pointer",
        transition: "outline 0.15s ease",
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
          }}
        >
          {blockId.slice(0, 8)}
        </div>
      )}
    </div>
  );
}

function RenderBlock({
  block,
  selectedBlockId,
  onSelectBlock,
}: {
  block: StorefrontBlockV2;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
}) {
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
            height: block.height,
            background: "repeating-linear-gradient(45deg, transparent, transparent 5px, var(--p-color-bg-surface-secondary) 5px, var(--p-color-bg-surface-secondary) 10px)",
            borderRadius: 4,
            opacity: 0.3,
          }}
        />
      );
      break;
    case "hero": {
      const layout = block.layout ?? "stack";
      content = (
        <section className={`sar-bundle__hero sar-bundle__hero--${layout}`}>
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt=""
              loading="lazy"
              className="sar-bundle__hero-img"
            />
          ) : (
            <div
              style={{
                width: 320,
                height: 200,
                background: "var(--p-color-bg-surface-secondary)",
                border: "2px dashed var(--p-color-border)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--p-color-text-subdued)",
                fontSize: "0.85rem",
              }}
            >
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
        <section
          className={
            "sar-bundle__split sar-bundle__split--img-" +
            (block.imageSide === "right" ? "right" : "left")
          }
        >
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt=""
              loading="lazy"
              className="sar-bundle__split-img"
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 150,
                background: "var(--p-color-bg-surface-secondary)",
                border: "2px dashed var(--p-color-border)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--p-color-text-subdued)",
                fontSize: "0.85rem",
                flexShrink: 0,
              }}
            >
              🖼️
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
      return null; // Rendered by the parent with steps context
    case "product_list":
      return null; // Rendered by the parent with steps context
    default:
      return null;
  }

  if (!content) return null;

  return (
    <InteractiveBlockWrapper
      blockId={block.id}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
    >
      {content}
    </InteractiveBlockWrapper>
  );
}

// SVG check mark for completed steps
function CheckSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StepBarPreview({
  block,
  steps,
  activeStepIndex,
  onStepClick,
  selectedBlockId,
  onSelectBlock,
}: {
  block: StepBarBlock;
  steps: { name: string }[];
  activeStepIndex: number;
  onStepClick: (stepIndex: number) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
}) {
  if (steps.length < 2) return null;
  const st = block.style ?? {};
  const preset = (block as { preset?: string }).preset ?? "default";

  // Determine dot size based on preset
  const dotSize = preset === "circles" ? 44 : preset === "minimal" ? 12 : 40;

  return (
    <InteractiveBlockWrapper
      blockId={block.id}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
    >
      <div
        style={{
          ["--sar-stepbar-border" as string]: st.borderColor ?? "",
          ["--sar-stepbar-active-bg" as string]:
            preset === "circles"
              ? (st.activeBg || "#ebcd75")
              : (st.activeBg ?? ""),
          ["--sar-stepbar-inactive-bg" as string]: st.inactiveBg ?? "",
          ["--sar-stepbar-active-text" as string]:
            preset === "circles"
              ? (st.activeTextColor || "#fff")
              : (st.activeTextColor ?? ""),
          ["--sar-stepbar-inactive-text" as string]: st.inactiveTextColor ?? "",
        }}
        className="sar-stepbar"
      >
        {steps.map((s, i) => {
          const isActive = i <= activeStepIndex;
          const isCompleted = i < activeStepIndex;
          const isCurrent = i === activeStepIndex;

          return (
            <div className="sar-stepbar__item" key={i}>
              <div className="sar-stepbar__top">
                <div
                  className={
                    "sar-stepbar__dot" +
                    (isActive ? " sar-stepbar__dot--active" : "")
                  }
                  title={s.name || `Étape ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStepClick(i);
                  }}
                  style={{
                    cursor: "pointer",
                    width: dotSize,
                    height: dotSize,
                    transition: "all 0.2s ease",
                    ...(preset === "circles" && isCompleted
                      ? {
                          background: st.activeBg || "#ebcd75",
                          borderColor: st.activeBg || "#ebcd75",
                        }
                      : {}),
                    ...(preset === "circles" && isCurrent
                      ? {
                          background: st.activeBg || "#ebcd75",
                          borderColor: st.activeBg || "#ebcd75",
                          boxShadow: `0 0 0 3px ${(st.activeBg || "#ebcd75")}33`,
                        }
                      : {}),
                    ...(preset === "minimal"
                      ? { borderRadius: "50%", border: "none" }
                      : {}),
                    ...(preset === "lines"
                      ? { borderRadius: 6, width: 32, height: 32, fontSize: "0.8rem" }
                      : {}),
                  }}
                >
                  {preset === "circles" && isCompleted ? (
                    <CheckSvg size={18} />
                  ) : preset === "minimal" ? (
                    ""
                  ) : (
                    i + 1
                  )}
                </div>
                {i < steps.length - 1 ? (
                  <div
                    className={
                      "sar-stepbar__line" +
                      (i < activeStepIndex ? " sar-stepbar__line--active" : "")
                    }
                    style={
                      preset === "minimal"
                        ? { borderTopWidth: 3 }
                        : preset === "circles"
                          ? {
                              borderTopWidth: 2,
                              ...(i < activeStepIndex
                                ? { borderTopColor: st.activeBg || "#ebcd75" }
                                : {}),
                            }
                          : {}
                    }
                  />
                ) : null}
              </div>
              <div
                className="sar-stepbar__label"
                style={{
                  cursor: "pointer",
                  fontWeight: isCurrent ? 600 : 400,
                  ...(preset === "circles" && isCurrent
                    ? { color: st.activeBg || "#ebcd75" }
                    : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onStepClick(i);
                }}
              >
                {(s.name || `Étape ${i + 1}`).slice(0, 24)}
              </div>
            </div>
          );
        })}
      </div>
    </InteractiveBlockWrapper>
  );
}

function ProductCard({ product }: { product: UiStepProduct }) {
  const [qty, setQty] = useState(1);

  const qtyBtnStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 4,
    border: "1px solid var(--p-color-border)",
    background: "var(--p-color-bg-surface)",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "1rem",
    color: "var(--p-color-text)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };

  return (
    <div className="sar-bundle__product sar-bundle__product--stack-add-to-qty">
      {product.imageUrl ? (
        <img className="sar-bundle__product-img" src={product.imageUrl} alt="" loading="lazy" />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "1",
            background: "var(--p-color-bg-surface-secondary)",
            border: "2px dashed var(--p-color-border)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--p-color-text-subdued)",
            fontSize: "2rem",
            marginBottom: "0.5rem",
          }}
        >
          📦
        </div>
      )}
      <p className="sar-bundle__product-title">{product.displayName || product.variantGid}</p>
      <div className="sar-bundle__product-price">—</div>

      <div className="sar-bundle__product-controls">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          style={qtyBtnStyle}
          aria-label="Diminuer"
        >
          −
        </button>
        <span
          style={{
            minWidth: 24,
            textAlign: "center",
            color: "var(--p-color-text)",
            fontWeight: 500,
          }}
        >
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQty((q) => q + 1)}
          style={qtyBtnStyle}
          aria-label="Augmenter"
        >
          +
        </button>
        <button type="button" className="sar-bundle__btn sar-bundle__btn--primary sar-bundle__add">
          Ajouter
        </button>
      </div>
    </div>
  );
}

export function BundleStorefrontPreview({
  design,
  steps,
  activeStepIndex,
  bundleTitle,
  onSelectStep,
  onSelectBlock,
  selectedBlockId,
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  bundleTitle: string;
  onSelectStep?: (stepIndex: number) => void;
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string | null;
}) {
  const g = design.global;
  const safeIndex = Math.min(
    Math.max(0, activeStepIndex),
    Math.max(0, steps.length - 1),
  );
  const step = steps[safeIndex];
  const hasProductListBlock = design.blocks.some((b) => b.type === "product_list");
  const blocks = useMemo(() => design.blocks ?? [], [design.blocks]);

  const handleStepClick = (idx: number) => {
    onSelectStep?.(idx);
  };

  const handleBlockSelect = (blockId: string) => {
    onSelectBlock?.(blockId);
  };

  return (
    <div className="sar-bundle" style={{ overflow: "auto" }}>
      <div style={{ maxWidth: g.contentMaxWidth || "720px", margin: "0 auto" }}>
        <div
          className="sar-bundle__design"
          style={{
            maxWidth: g.contentMaxWidth || "720px",
            background: g.pageBackground || "transparent",
            marginBottom: "1rem",
          }}
        >
          {blocks.map((b) => {
            if (b.type === "step_bar") {
              return (
                <StepBarPreview
                  key={b.id}
                  block={b}
                  steps={steps}
                  activeStepIndex={safeIndex}
                  onStepClick={handleStepClick}
                  selectedBlockId={selectedBlockId ?? null}
                  onSelectBlock={handleBlockSelect}
                />
              );
            }
            if (b.type === "product_list") return null;
            return (
              <RenderBlock
                key={b.id}
                block={b}
                selectedBlockId={selectedBlockId ?? null}
                onSelectBlock={handleBlockSelect}
              />
            );
          })}
        </div>

        <h2 className="sar-bundle__title">{bundleTitle.trim() || "Bundle"}</h2>

        <div className="sar-bundle__steps">
          {steps.map((s, i) => (
            <span
              key={i}
              className={
                "sar-bundle__step-pill" + (i === safeIndex ? " sar-bundle__step-pill--active" : "")
              }
              style={{ cursor: "pointer" }}
              onClick={() => handleStepClick(i)}
            >
              {(s.name || `Étape ${i + 1}`).slice(0, 48)}
            </span>
          ))}
        </div>

        {!hasProductListBlock && step ? (
          <div className="sar-bundle__body">
            <div className="sar-bundle__products">
              {step.products.map((p) => (
                <ProductCard key={p.variantGid} product={p} />
              ))}
              {step.products.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "2rem",
                    textAlign: "center",
                    color: "var(--p-color-text-subdued)",
                    border: "2px dashed var(--p-color-border)",
                    borderRadius: 8,
                  }}
                >
                  Aucun produit dans cette étape
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

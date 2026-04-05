import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  StepBarBlock,
  StorefrontBlockV2,
  StorefrontDesignV2,
  TextStyleBlock,
} from "../../utils/storefront-design";
import { blockDisplayLabel } from "../../utils/storefront-design";
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

// Interactive wrapper with hover/click selection — uses inset boxShadow for reliable interaction
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

function RenderBlock({
  block,
  selectedBlockId,
  onSelectBlock,
}: {
  block: StorefrontBlockV2;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
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
            height: block.height,
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 5px, var(--p-color-bg-surface-secondary) 5px, var(--p-color-bg-surface-secondary) 10px)",
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
      blockName={name}
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
  const dotSize = preset === "circles" ? 44 : preset === "minimal" ? 12 : 40;
  const blockName = blockDisplayLabel(block);

  return (
    <InteractiveBlockWrapper
      blockId={block.id}
      blockName={blockName}
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
                  textAlign: "center",
                  width: "100%",
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

/* ────────── Product Card: "Classic" design ────────── */
/* Image + Title + "Add to box" button that transforms into qty selector */
function ProductCardClassic({ product }: { product: UiStepProduct }) {
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: "100%",
      height: "100%",
      justifyContent: "space-between",
      textAlign: "left",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Image */}
        <div style={{
          width: "100%",
          borderRadius: 4,
          overflow: "hidden",
          aspectRatio: "1",
          background: "var(--p-color-bg-surface-secondary)",
        }}>
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt=""
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--p-color-text-subdued)",
              fontSize: "2rem",
            }}>📦</div>
          )}
        </div>
        {/* Title */}
        <span style={{
          fontSize: 16,
          fontWeight: 500,
          lineHeight: "normal",
          color: "var(--p-color-text)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {product.displayName || "Produit"}
        </span>
      </div>

      {/* Button / Quantity selector */}
      {!added ? (
        <button
          type="button"
          onClick={() => setAdded(true)}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: "1px solid var(--p-color-border)",
            padding: "8px 16px",
            height: 40,
            borderRadius: 4,
            background: "var(--p-color-bg-surface)",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--p-color-text)",
            width: "100%",
            transition: "all 0.15s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "var(--p-color-bg-surface-hover)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "var(--p-color-bg-surface)";
          }}
        >
          Add to box
        </button>
      ) : (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
          overflow: "hidden",
          borderRadius: 4,
          height: 40,
          border: "1px solid var(--p-color-border)",
        }}>
          <button
            type="button"
            onClick={() => {
              if (qty <= 1) { setAdded(false); setQty(1); }
              else setQty(q => q - 1);
            }}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              height: "100%",
              color: "var(--p-color-text)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 400, color: "var(--p-color-text)" }}>{qty}</span>
          <button
            type="button"
            onClick={() => setQty(q => q + 1)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              height: "100%",
              color: "var(--p-color-text)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────── Product Card: "Overlay" design ────────── */
/* Image with hover overlay button + title/price below */
function ProductCardOverlay({ product }: { product: UiStepProduct }) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      width: "100%",
      textAlign: "left",
    }}>
      {/* Image with overlay */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 4,
          aspectRatio: "1",
          background: "var(--p-color-bg-surface-secondary)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--p-color-text-subdued)",
            fontSize: "2rem",
          }}>📦</div>
        )}

        {/* Overlay button */}
        <div style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          right: 10,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          opacity: hovered || added ? 1 : 0,
          transform: hovered || added ? "translateY(0)" : "translateY(8px)",
          transition: "all 0.2s ease",
          zIndex: 2,
        }}>
          {!added ? (
            <button
              type="button"
              onClick={() => setAdded(true)}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                border: "1px solid var(--p-color-border)",
                padding: "8px 16px",
                height: 40,
                borderRadius: 4,
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(4px)",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--p-color-text)",
                width: "100%",
              }}
            >
              Add to box
            </button>
          ) : (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(4px)",
              overflow: "hidden",
              borderRadius: 4,
              height: 40,
              border: "1px solid var(--p-color-border)",
            }}>
              <button
                type="button"
                onClick={() => {
                  if (qty <= 1) { setAdded(false); setQty(1); }
                  else setQty(q => q - 1);
                }}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  height: "100%",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
              <span style={{ fontSize: 16, fontWeight: 400 }}>{qty}</span>
              <button
                type="button"
                onClick={() => setQty(q => q + 1)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "8px 12px",
                  height: "100%",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Title + Price */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{
          fontSize: 16,
          fontWeight: 500,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          color: "var(--p-color-text)",
        }}>
          {product.displayName || "Produit"}
        </span>
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--p-color-text)",
        }}>
          —
        </span>
      </div>
    </div>
  );
}

function ProductCard({ product, layout }: { product: UiStepProduct; layout?: string }) {
  if (layout === "overlay") return <ProductCardOverlay product={product} />;
  return <ProductCardClassic product={product} />;
}

/** Product grid rendered inside the preview */
function ProductGridPreview({
  step,
  block,
  selectedBlockId,
  onSelectBlock,
}: {
  step: UiStep | undefined;
  block: StorefrontBlockV2;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
}) {
  const plBlock = block.type === "product_list" ? block : null;
  const columns = plBlock?.columns ?? 3;
  const gapX = plBlock?.gapX ?? 16;
  const gapY = plBlock?.gapY ?? 16;
  const cardLayout = plBlock?.cardLayout ?? "classic";

  return (
    <InteractiveBlockWrapper
      blockId={block.id}
      blockName={blockDisplayLabel(block)}
      selectedBlockId={selectedBlockId}
      onSelectBlock={onSelectBlock}
    >
      <div style={{ width: "100%" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: `${gapY}px ${gapX}px`,
            width: "100%",
          }}
        >
          {step && step.products.length > 0 ? (
            step.products.map((p) => (
              <ProductCard key={p.variantGid} product={p} layout={cardLayout} />
            ))
          ) : (
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
              Aucun produit dans cette étape — ajoutez des produits dans la mise en page.
            </div>
          )}
        </div>
      </div>
    </InteractiveBlockWrapper>
  );
}

export function BundleStorefrontPreview({
  design,
  steps,
  activeStepIndex,
  onSelectStep,
  onSelectBlock,
  selectedBlockId,
  hiddenBlocks,
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  onSelectStep?: (stepIndex: number) => void;
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string | null;
  hiddenBlocks?: Set<string>;
}) {
  const g = design.global;
  const safeIndex = Math.min(
    Math.max(0, activeStepIndex),
    Math.max(0, steps.length - 1),
  );
  const step = steps[safeIndex];
  const blocks = useMemo(() => design.blocks ?? [], [design.blocks]);
  const hidden = hiddenBlocks ?? new Set<string>();

  // Check if any product_list block exists
  const hasProductListBlock = blocks.some((b) => b.type === "product_list");

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
            // Skip hidden blocks
            if (hidden.has(b.id)) return null;

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
            if (b.type === "product_list") {
              return (
                <ProductGridPreview
                  key={b.id}
                  step={step}
                  block={b}
                  selectedBlockId={selectedBlockId ?? null}
                  onSelectBlock={handleBlockSelect}
                />
              );
            }
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

        {/* Fallback: if no product_list block exists, show products anyway */}
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

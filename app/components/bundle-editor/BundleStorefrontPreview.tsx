import { useState } from "react";
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

function RenderBlock({ block }: { block: StorefrontBlockV2 }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.tag;
      return (
        <Tag style={textStyleToCss(block.style)}>{block.text}</Tag>
      );
    }
    case "text":
      return (
        <p style={textStyleToCss(block.style)}>{block.text}</p>
      );
    case "image":
      return block.url ? (
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
      ) : null;
    case "spacer":
      return <div style={{ height: block.height }} />;
    case "hero": {
      const layout = block.layout ?? "stack";
      const img = block.imageUrl ? (
        <img
          src={block.imageUrl}
          alt=""
          style={{
            width: "100%",
            maxWidth: 320,
            borderRadius: 8,
            objectFit: "cover",
          }}
        />
      ) : null;
      const textCol = (
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.5rem",
              color: "var(--p-color-text)",
            }}
          >
            {block.headline}
          </h2>
          {block.subtext ? (
            <p style={{ margin: 0, opacity: 0.85, color: "var(--p-color-text)" }}>
              {block.subtext}
            </p>
          ) : null}
        </div>
      );
      if (layout === "stack") {
        return (
          <section style={{ marginBottom: "1rem" }}>
            {img}
            {textCol}
          </section>
        );
      }
      return (
        <section
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            marginBottom: "1rem",
            flexDirection:
              layout === "image_right" ? "row-reverse" : "row",
            flexWrap: "wrap",
          }}
        >
          {img}
          {textCol}
        </section>
      );
    }
    case "split": {
      const imgSide = block.imageSide === "right" ? "row-reverse" : "row";
      return (
        <section
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1rem",
            flexDirection: imgSide,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt=""
              style={{
                width: "100%",
                maxWidth: 200,
                borderRadius: 8,
              }}
            />
          ) : null}
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ margin: "0 0 0.35rem", color: "var(--p-color-text)" }}>
              {block.title}
            </h3>
            <p
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                color: "var(--p-color-text)",
              }}
            >
              {block.body}
            </p>
          </div>
        </section>
      );
    }
    case "product_grid": {
      const label =
        block.source === "collection"
          ? `Collection « ${block.collectionHandle || "…"} »`
          : block.source === "all"
            ? "Tout le catalogue"
            : "Sélection manuelle";
      return (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px dashed var(--p-color-border)",
            borderRadius: 8,
            background: "var(--p-color-bg-surface-secondary, rgba(0,0,0,0.02))",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              marginBottom: 8,
              fontWeight: 600,
              color: "var(--p-color-text)",
            }}
          >
            Bloc produits ({block.display}) — {label}
          </div>
          {block.rules?.length ? (
            <div
              style={{
                fontSize: "0.75rem",
                opacity: 0.8,
                color: "var(--p-color-text-secondary, #6d7175)",
              }}
            >
              {block.rules.length} règle(s) d'affichage
            </div>
          ) : null}
        </div>
      );
    }
    case "step_bar":
      return null; // Rendered by the parent with steps context
    case "product_list":
      return null; // Rendered by the parent with steps context
    default:
      return null;
  }
}

function StepBarPreview({
  block,
  steps,
  activeStepIndex,
}: {
  block: StepBarBlock;
  steps: { name: string }[];
  activeStepIndex: number;
}) {
  if (steps.length < 2) return null;
  const st = block.style ?? {};
  return (
    <div
      style={{
        ["--sar-stepbar-border" as any]: st.borderColor ?? "",
        ["--sar-stepbar-active-bg" as any]: st.activeBg ?? "",
        ["--sar-stepbar-inactive-bg" as any]: st.inactiveBg ?? "",
        ["--sar-stepbar-active-text" as any]: st.activeTextColor ?? "",
        ["--sar-stepbar-inactive-text" as any]: st.inactiveTextColor ?? "",
      }}
      className="sar-stepbar"
    >
      {steps.map((s, i) => (
        <div className="sar-stepbar__item" key={i}>
          <div className="sar-stepbar__top">
            <div
              className={
                "sar-stepbar__dot" +
                (i <= activeStepIndex ? " sar-stepbar__dot--active" : "")
              }
              title={s.name || `Étape ${i + 1}`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 ? <div className="sar-stepbar__line" /> : null}
          </div>
          <div className="sar-stepbar__label">
            {(s.name || `Étape ${i + 1}`).slice(0, 24)}
          </div>
        </div>
      ))}
    </div>
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
    <div className="sar-bundle__product">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 72,
            background:
              "var(--p-color-bg-fill-secondary, #f6f6f7)",
            borderRadius: 4,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            color: "var(--p-color-text-secondary, #6d7175)",
          }}
        >
          Aucune image
        </div>
      )}
      <div className="sar-bundle__product-title">
        {product.displayName}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 8,
          justifyContent: "center",
        }}
      >
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
      </div>

      <button
        type="button"
        style={{
          marginTop: 8,
          width: "100%",
          padding: "6px 0",
          background: "var(--p-color-bg-fill-brand)",
          color: "var(--p-color-text-on-color)",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.8rem",
        }}
      >
        Ajouter au panier
      </button>
    </div>
  );
}

export function BundleStorefrontPreview({
  design,
  steps,
  activeStepIndex,
  bundleTitle,
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  bundleTitle: string;
}) {
  const g = design.global;
  const step = steps[activeStepIndex];
  const safeIndex = Math.min(
    Math.max(0, activeStepIndex),
    Math.max(0, steps.length - 1),
  );
  const hasProductListBlock = design.blocks.some((b) => b.type === "product_list");

  return (
    <div
      className="sar-bundle"
      style={{
        fontFamily: g.fontBody || "var(--p-font-family-sans, system-ui, sans-serif)",
        background: g.pageBackground || "var(--p-color-bg-surface, #fafafa)",
        minHeight: 280,
        overflow: "auto",
      }}
    >
      <div
        style={{
          maxWidth: g.contentMaxWidth || "720px",
          margin: "0 auto",
        }}
      >
        {design.blocks.map((b) => {
          if (b.type === "step_bar") {
            return (
              <StepBarPreview
                key={b.id}
                block={b}
                steps={steps}
                activeStepIndex={safeIndex}
              />
            );
          }
          if (b.type === "product_list") {
            return step ? (
              <div key={b.id}>
                {step.description ? (
                  <p
                    style={{
                      margin: "0 0 0.75rem",
                      fontSize: "0.9rem",
                      color: "var(--p-color-text)",
                    }}
                  >
                    {step.description}
                  </p>
                ) : null}
                <div className="sar-bundle__products">
                  {step.products.length === 0 ? (
                    <div
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--p-color-text-secondary, #6d7175)",
                        padding: "0.5rem 0",
                      }}
                    >
                      Aucun produit sur cette étape (aperçu).
                    </div>
                  ) : (
                    step.products.map((p) => (
                      <ProductCard key={p.variantGid} product={p} />
                    ))
                  )}
                </div>
              </div>
            ) : null;
          }
          return <RenderBlock key={b.id} block={b} />;
        })}

        <h2
          style={{
            fontFamily: g.fontHeading || "var(--p-font-family-sans, system-ui, sans-serif)",
            fontSize: "1.25rem",
            margin: "0.75rem 0",
            color: "var(--p-color-text)",
          }}
        >
          {bundleTitle.trim() || "Bundle"}
        </h2>

        {!hasProductListBlock && step ? (
          <div style={{ marginTop: 8 }}>
            {step.description ? (
              <p
                style={{
                  margin: "0 0 0.75rem",
                  fontSize: "0.9rem",
                  color: "var(--p-color-text)",
                }}
              >
                {step.description}
              </p>
            ) : null}
            <div className="sar-bundle__products">
              {step.products.length === 0 ? (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--p-color-text-secondary, #6d7175)",
                    padding: "0.5rem 0",
                  }}
                >
                  Aucun produit sur cette étape (aperçu).
                </div>
              ) : (
                step.products.map((p) => (
                  <ProductCard key={p.variantGid} product={p} />
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

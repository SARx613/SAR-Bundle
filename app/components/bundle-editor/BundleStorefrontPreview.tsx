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
      return (
        <section className={`sar-bundle__hero sar-bundle__hero--${layout}`}>
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt=""
              loading="lazy"
              className="sar-bundle__hero-img"
            />
          ) : null}
          <div className="sar-bundle__hero-text">
            <h2>{block.headline}</h2>
            {block.subtext ? <p>{block.subtext}</p> : null}
          </div>
        </section>
      );
    }
    case "split": {
      return (
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
          ) : null}
          <div className="sar-bundle__split-body">
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </div>
        </section>
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
            {i < steps.length - 1 ? (
              <div
                className={
                  "sar-stepbar__line" +
                  (i < activeStepIndex ? " sar-stepbar__line--active" : "")
                }
              />
            ) : null}
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
    <div className="sar-bundle__product sar-bundle__product--stack-add-to-qty">
      {product.imageUrl ? (
        <img className="sar-bundle__product-img" src={product.imageUrl} alt="" loading="lazy" />
      ) : (
        <img className="sar-bundle__product-img" alt="" loading="lazy" />
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
}: {
  design: StorefrontDesignV2;
  steps: UiStep[];
  activeStepIndex: number;
  bundleTitle: string;
}) {
  const g = design.global;
  const safeIndex = Math.min(
    Math.max(0, activeStepIndex),
    Math.max(0, steps.length - 1),
  );
  const step = steps[safeIndex];
  const hasProductListBlock = design.blocks.some((b) => b.type === "product_list");
  const blocks = useMemo(() => design.blocks ?? [], [design.blocks]);

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
              />
            );
          }
            if (b.type === "product_list") return null;
            return <RenderBlock key={b.id} block={b} />;
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
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

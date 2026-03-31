import type { CSSProperties } from "react";
import type {
  StorefrontBlockV2,
  StorefrontDesignV2,
  TextStyleBlock,
} from "../../utils/storefront-design";
import type { UiStep } from "../../utils/bundle-form.client";

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
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
            {block.headline}
          </h2>
          {block.subtext ? (
            <p style={{ margin: 0, opacity: 0.85 }}>{block.subtext}</p>
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
            <h3 style={{ margin: "0 0 0.35rem" }}>{block.title}</h3>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{block.body}</p>
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
            border: "1px dashed #c9cccf",
            borderRadius: 8,
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontSize: "0.8rem", marginBottom: 8, fontWeight: 600 }}>
            Bloc produits ({block.display}) — {label}
          </div>
          {block.rules?.length ? (
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              {block.rules.length} règle(s) d’affichage
            </div>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
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
  const showStepBar = steps.length > 1;

  return (
    <div
      style={{
        fontFamily: g.fontBody,
        background: g.pageBackground || "#fafafa",
        minHeight: 280,
        padding: "1rem",
        borderRadius: 12,
        border: "1px solid var(--p-color-border, #e3e3e3)",
        overflow: "auto",
      }}
    >
      <div
        style={{
          maxWidth: g.contentMaxWidth || "720px",
          margin: "0 auto",
        }}
      >
        {design.blocks.map((b) => (
          <RenderBlock key={b.id} block={b} />
        ))}

        <h2
          style={{
            fontFamily: g.fontHeading,
            fontSize: "1.25rem",
            margin: "0.75rem 0",
          }}
        >
          {bundleTitle.trim() || "Bundle"}
        </h2>

        {showStepBar ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: "0.75rem",
            }}
          >
            {steps.map((s, i) => (
              <span
                key={s.sortOrder + String(i)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  background: i === safeIndex ? "#2c6ecb" : "#e4e5e7",
                  color: i === safeIndex ? "#fff" : "#202223",
                }}
              >
                {(s.name || `Étape ${i + 1}`).slice(0, 40)}
              </span>
            ))}
          </div>
        ) : null}

        {step ? (
          <div style={{ marginTop: 8 }}>
            {step.description ? (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem" }}>
                {step.description}
              </p>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {step.products.length === 0 ? (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#6d7175",
                    padding: "0.5rem 0",
                  }}
                >
                  Aucun produit sur cette étape (aperçu).
                </div>
              ) : (
                step.products.map((p) => (
                  <div
                    key={p.variantGid}
                    style={{
                      border: "1px solid #e3e3e3",
                      borderRadius: 8,
                      padding: 8,
                      fontSize: "0.8rem",
                      background: "#fff",
                    }}
                  >
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: 72,
                          objectFit: "cover",
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                      />
                    ) : null}
                    <div style={{ fontWeight: 500, lineHeight: 1.3 }}>
                      {p.displayName}
                    </div>
                    <div style={{ opacity: 0.6, marginTop: 4 }}>
                      {p.layoutPreset.replace(/_/g, " ").toLowerCase()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

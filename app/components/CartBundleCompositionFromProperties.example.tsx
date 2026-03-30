/**
 * Exemple pour un panier React (Hydrogen, extension checkout UI, etc.) :
 * lire `line_item.properties['_sar_bundle_components']` (JSON string) posé par
 * le bundle-builder storefront.
 */
export type SarBundleComponentRow = {
  variantGid: string;
  variantId: number | null;
  productTitle: string;
  variantTitle: string;
  imageUrl: string;
  quantity: number;
};

export function parseSarBundleComponents(
  properties: Record<string, string> | undefined,
): SarBundleComponentRow[] | null {
  const raw = properties?._sar_bundle_components;
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as SarBundleComponentRow[];
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

export function CartBundleCompositionList({
  properties,
}: {
  properties: Record<string, string> | undefined;
}) {
  const rows = parseSarBundleComponents(properties);
  if (!rows?.length) return null;
  return (
    <ul
      className="sar-bundle-cart-composition"
      data-sar-bundle-cart-composition
    >
      {rows.map((c, i) => (
        <li
          key={`${c.variantGid}-${i}`}
          className="sar-bundle-cart-composition__row"
        >
          {c.imageUrl ? (
            <img
              className="sar-bundle-cart-composition__img"
              src={c.imageUrl}
              alt=""
              width={48}
              height={48}
              loading="lazy"
            />
          ) : null}
          <span className="sar-bundle-cart-composition__text">
            {c.quantity > 1 ? (
              <span className="sar-bundle-cart-composition__qty">
                {c.quantity}×{" "}
              </span>
            ) : null}
            <span className="sar-bundle-cart-composition__title">
              {c.productTitle}
            </span>
            {c.variantTitle && c.variantTitle !== "Default Title" ? (
              <span className="sar-bundle-cart-composition__variant">
                {" "}
                — {c.variantTitle}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

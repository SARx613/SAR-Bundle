// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {unknown} s
 * @returns {s is string}
 */
function isHttpUrlString(s) {
  return (
    typeof s === "string" && /^https?:\/\//i.test(s.trim())
  );
}

/**
 * @param {unknown} row
 * @returns {{ q: number; p: string; v: string; i: string }}
 */
function normalizeBreakdownRow(row) {
  if (row && typeof row === "object") {
    const q =
      typeof row.q === "number"
        ? row.q
        : parseInt(String(row.q), 10) || 1;
    return {
      q,
      p: String(row.p || ""),
      v: String(row.v || ""),
      i: String(row.i || ""),
    };
  }
  return { q: 1, p: "", v: "", i: "" };
}

/**
 * Storefront envoie des lignes `q\\tp\\tv\\ti` séparées par `[[SAR]]` (sans JSON).
 * On accepte encore l’ancien JSON pour les paniers déjà remplis.
 *
 * @param {unknown} raw
 * @returns {{ q: number; p?: string; v?: string; i?: string }[] | null}
 */
function parseBreakdown(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const j = JSON.parse(trimmed);
      if (!Array.isArray(j)) {
        return null;
      }
      return j.map((r) => normalizeBreakdownRow(r));
    } catch {
      return null;
    }
  }
  const segs = trimmed.split("[[SAR]]");
  /** @type {{ q: number; p: string; v: string; i: string }[]} */
  const out = [];
  for (const seg of segs) {
    const line = seg.trim();
    if (!line) {
      continue;
    }
    const cells = line.split("\t");
    const q = parseInt(String(cells[0] || "1"), 10) || 1;
    out.push({
      q,
      p: cells[1] || "",
      v: cells[2] || "",
      i: cells[3] || "",
    });
  }
  return out.length ? out : null;
}

/**
 * @param {{ q?: number; p?: string; v?: string }[]} items
 * @returns {string}
 */
function formatCompositionPlain(items) {
  if (!items?.length) {
    return "";
  }
  const lines = [];
  for (const row of items) {
    const q = typeof row.q === "number" && row.q > 1 ? `${row.q}× ` : "";
    const p = row.p || "";
    const vRaw = row.v && String(row.v).trim();
    const v =
      vRaw &&
      vRaw !== "Default Title" &&
      vRaw.toLowerCase() !== "default title"
        ? ` — ${vRaw}`
        : "";
    lines.push(`${q}${p}${v}`);
  }
  return lines.join("\n");
}

/**
 * @param {NonNullable<CartTransformRunInput["cart"]>["lines"]} lines
 * @returns {string}
 */
function fallbackCompositionFromLines(lines) {
  const parts = [];
  for (const line of lines) {
    const m = line.merchandise;
    if (!m || m.__typename !== "ProductVariant") {
      continue;
    }
    const pt = m.product?.title || "";
    const vt = m.title;
    let seg = pt;
    if (
      vt &&
      vt !== "Default Title" &&
      vt !== "Default"
    ) {
      seg += ` — ${vt}`;
    }
    const q = line.quantity > 1 ? `${line.quantity}× ` : "";
    parts.push(`${q}${seg}`);
  }
  return parts.join("\n");
}

const ATTR_VALUE_MAX = 5000;

/**
 * Groups cart lines by `_sar_bundle_id` and merges components into one parent line
 * (Cart Transform API `linesMerge`) when there are 2+ lines and `_sar_parent_variant_id` is set.
 *
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const lines = input?.cart?.lines;
  if (!lines?.length) {
    return NO_CHANGES;
  }

  /** @type {Map<string, { parentVariantId: string; lines: typeof lines }>} */
  const groups = new Map();

  for (const line of lines) {
    if (line.parentRelationship) {
      continue;
    }
    const bundleKey = line.sarBundleId?.value;
    const parentVariantId = line.sarParentVariantId?.value;
    if (!bundleKey || !parentVariantId) {
      continue;
    }
    let g = groups.get(bundleKey);
    if (!g) {
      g = { parentVariantId, lines: [] };
      groups.set(bundleKey, g);
    }
    g.lines.push(line);
  }

  /** @type {CartTransformRunResult["operations"]} */
  const operations = [];

  for (const [, group] of groups) {
    if (group.lines.length < 2) {
      continue;
    }
    const mergeTitle = group.lines[0]?.sarBundleTitle?.value;

    const bundleImage = group.lines
      .map((l) => l.sarBundleImage?.value)
      .find((v) => isHttpUrlString(v));

    const rawBreakdown =
      group.lines.find((l) => l.sarBundleBreakdown?.value)?.sarBundleBreakdown
        ?.value ?? "";

    const parsed = parseBreakdown(rawBreakdown);
    let compositionPlain = formatCompositionPlain(parsed || []);
    if (!compositionPlain) {
      compositionPlain = fallbackCompositionFromLines(group.lines);
    }

    /** @type {{ key: string; value: string }[]} */
    const attributes = [];
    if (
      rawBreakdown &&
      typeof rawBreakdown === "string" &&
      rawBreakdown.length <= ATTR_VALUE_MAX
    ) {
      attributes.push({
        key: "_sar_bundle_breakdown",
        value: rawBreakdown.slice(0, ATTR_VALUE_MAX),
      });
    }
    if (compositionPlain) {
      attributes.push({
        key: "Composition du pack",
        value: compositionPlain.slice(0, ATTR_VALUE_MAX),
      });
    }

    operations.push({
      linesMerge: {
        parentVariantId: group.parentVariantId,
        ...(mergeTitle ? { title: mergeTitle } : {}),
        ...(bundleImage
          ? { image: { url: String(bundleImage).trim() } }
          : {}),
        ...(attributes.length ? { attributes } : {}),
        cartLines: group.lines.map((l) => ({
          cartLineId: l.id,
          quantity: l.quantity,
        })),
      },
    });
  }

  if (!operations.length) {
    return NO_CHANGES;
  }

  return { operations };
}

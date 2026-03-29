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
    operations.push({
      linesMerge: {
        parentVariantId: group.parentVariantId,
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

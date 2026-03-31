// @ts-check

/**
 * Bundles natifs Shopify (inventory-safe):
 * - Le storefront ajoute les composants (variants individuels) + 1 parent variant.
 * - Cette fonction MERGE les lignes d’un même groupe en une seule ligne parent.
 *
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = { operations: [] };

/**
 * @param {CartTransformRunInput} _input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(_input) {
  var lines = (_input && _input.cart && _input.cart.lines) || [];
  if (!Array.isArray(lines) || !lines.length) return NO_CHANGES;

  // groupKey -> { parentLine, childLines[] }
  var groups = {};

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line || !line.id) continue;
    var g = line.bundle_group && line.bundle_group.value != null ? String(line.bundle_group.value) : null;
    if (!g) continue;
    var isParent =
      line.bundle_parent && String(line.bundle_parent.value || '') === '1';
    var isChild =
      line.bundle_child && String(line.bundle_child.value || '') === '1';
    if (!isParent && !isChild) continue;
    if (!groups[g]) groups[g] = { parent: null, children: [] };
    if (isParent) groups[g].parent = line;
    if (isChild) groups[g].children.push(line);
  }

  var ops = [];
  for (var key in groups) {
    if (!Object.prototype.hasOwnProperty.call(groups, key)) continue;
    var grp = groups[key];
    if (!grp.parent || !grp.children || grp.children.length === 0) continue;
    var parentVarId = grp.parent.merchandise && grp.parent.merchandise.id;
    if (!parentVarId) continue;

    var cartLines = [];
    for (var c = 0; c < grp.children.length; c++) {
      var cl = grp.children[c];
      cartLines.push({ cartLineId: cl.id, quantity: cl.quantity || 1 });
    }

    ops.push({
      merge: {
        parentVariantId: parentVarId,
        cartLines: cartLines,
        // No need to copy all attributes; Shopify will keep parent line attributes
        attributes: [],
        title: null,
      },
    });
  }

  return ops.length ? { operations: ops } : NO_CHANGES;
}

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

    var cartLines = [
      { cartLineId: grp.parent.id, quantity: grp.parent.quantity || 1 },
    ];
    for (var c = 0; c < grp.children.length; c++) {
      var cl = grp.children[c];
      cartLines.push({ cartLineId: cl.id, quantity: cl.quantity || 1 });
    }

    var mergedAttrs = [];
    var seenKeys = {};
    function pushAttr(k, v) {
      if (!k || v == null || v === '' || seenKeys[k]) return;
      seenKeys[k] = true;
      mergedAttrs.push({ key: String(k), value: String(v) });
    }

    if (grp.parent.bundle_group && grp.parent.bundle_group.value != null) {
      pushAttr('_sar_bundle_group', grp.parent.bundle_group.value);
    }
    if (grp.parent.bundle_parent && grp.parent.bundle_parent.value != null) {
      pushAttr('_sar_bundle_parent', grp.parent.bundle_parent.value);
    }
    if (grp.parent.bundle_id && grp.parent.bundle_id.value != null) {
      pushAttr('_sar_bundle_id', grp.parent.bundle_id.value);
    }
    if (grp.parent.bundle_config_id && grp.parent.bundle_config_id.value != null) {
      pushAttr('_sar_bundle_config_id', grp.parent.bundle_config_id.value);
    }
    if (grp.parent.bundle_name && grp.parent.bundle_name.value != null) {
      pushAttr('_sar_bundle_name', grp.parent.bundle_name.value);
    }
    if (grp.parent.bundle_components && grp.parent.bundle_components.value != null) {
      pushAttr('_sar_bundle_components', grp.parent.bundle_components.value);
    }
    if (grp.parent.composition && grp.parent.composition.value != null) {
      pushAttr('Composition', grp.parent.composition.value);
    }
    if (Array.isArray(grp.parent.attributes)) {
      for (var ai = 0; ai < grp.parent.attributes.length; ai++) {
        var at = grp.parent.attributes[ai];
        if (at && at.key && at.key !== '_sar_bundle_child') {
          pushAttr(at.key, at.value);
        }
      }
    }

    ops.push({
      merge: {
        parentVariantId: parentVarId,
        cartLines: cartLines,
        attributes: mergedAttrs,
        title: null,
      },
    });
  }

  return ops.length ? { operations: ops } : NO_CHANGES;
}

// @ts-check

/**
 * Ancienne logique `linesMerge` retirée : le panier reçoit une seule ligne
 * (produit bundle + propriétés `_sar_bundle_components`). Cette fonction ne
 * modifie plus le panier.
 *
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
 * @param {CartTransformRunInput} _input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(_input) {
  return NO_CHANGES;
}

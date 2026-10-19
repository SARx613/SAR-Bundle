import { describe, test, expect } from "vitest";
import { cartTransformRun } from "../src/cart_transform_run.js";

describe("cartTransformRun unit tests", () => {
  test("returns NO_CHANGES when cart is empty or has no bundle lines", () => {
    expect(cartTransformRun({})).toEqual({ operations: [] });
    expect(cartTransformRun({ cart: { lines: [] } })).toEqual({ operations: [] });
    expect(
      cartTransformRun({
        cart: {
          lines: [
            {
              id: "gid://shopify/CartLine/1",
              quantity: 1,
              merchandise: { id: "gid://shopify/ProductVariant/100" },
            },
          ],
        },
      }),
    ).toEqual({ operations: [] });
  });

  test("merges a parent line and child lines of the same group and preserves parent attributes", () => {
    const input = {
      cart: {
        lines: [
          {
            id: "gid://shopify/CartLine/parent-1",
            quantity: 1,
            bundle_group: { value: "grp-123" },
            bundle_parent: { value: "1" },
            bundle_id: { value: "bundle-abc" },
            composition: { value: "2x Savon — Lavande" },
            attributes: [
              { key: "_sar_bundle_config_id", value: "bundle-abc" },
              { key: "Message cadeau", value: "Joyeux anniversaire" },
            ],
            merchandise: {
              id: "gid://shopify/ProductVariant/999",
            },
          },
          {
            id: "gid://shopify/CartLine/child-1",
            quantity: 2,
            bundle_group: { value: "grp-123" },
            bundle_child: { value: "1" },
            merchandise: {
              id: "gid://shopify/ProductVariant/101",
            },
          },
          {
            id: "gid://shopify/CartLine/child-2",
            quantity: 1,
            bundle_group: { value: "grp-123" },
            bundle_child: { value: "1" },
            merchandise: {
              id: "gid://shopify/ProductVariant/102",
            },
          },
        ],
      },
    };

    const result = cartTransformRun(input);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0]).toEqual({
      merge: {
        parentVariantId: "gid://shopify/ProductVariant/999",
        cartLines: [
          { cartLineId: "gid://shopify/CartLine/parent-1", quantity: 1 },
          { cartLineId: "gid://shopify/CartLine/child-1", quantity: 2 },
          { cartLineId: "gid://shopify/CartLine/child-2", quantity: 1 },
        ],
        attributes: [
          { key: "_sar_bundle_group", value: "grp-123" },
          { key: "_sar_bundle_parent", value: "1" },
          { key: "_sar_bundle_id", value: "bundle-abc" },
          { key: "Composition", value: "2x Savon — Lavande" },
          { key: "_sar_bundle_config_id", value: "bundle-abc" },
          { key: "Message cadeau", value: "Joyeux anniversaire" },
        ],
        title: null,
      },
    });
  });
});


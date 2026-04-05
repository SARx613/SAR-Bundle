export const PRODUCT_DISPLAY_FIELDS = `
  fragment ProductDisplayFields on Product {
    title
    handle
    featuredImage {
      url(transform: { maxWidth: 1024 })
      altText
    }
  }
`;

export const VARIANT_DISPLAY_FIELDS = `
  fragment VariantDisplayFields on ProductVariant {
    id
    title
    image {
      url(transform: { maxWidth: 1024 })
      altText
    }
    product {
      ...ProductDisplayFields
    }
    price
    compareAtPrice
  }
`;


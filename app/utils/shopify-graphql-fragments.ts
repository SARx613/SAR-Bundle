export const PRODUCT_DISPLAY_FIELDS = `#graphql
  fragment ProductDisplayFields on Product {
    title
    handle
    featuredImage {
      url(transform: { maxWidth: 1024 })
      altText
    }
  }
`;

export const VARIANT_DISPLAY_FIELDS = `#graphql
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
    price {
      amount
      currencyCode
    }
    compareAtPrice {
      amount
      currencyCode
    }
  }
`;


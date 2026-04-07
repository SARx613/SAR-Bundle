export async function createUsageRecord(
  admin: any,
  subscriptionLineItemId: string,
  price: number,
  description: string
) {
  try {
    const response = await admin.graphql(
      `#graphql
      mutation appUsageRecordCreate($description: String!, $price: MoneyInput!, $subscriptionLineItemId: ID!) {
        appUsageRecordCreate(description: $description, price: $price, subscriptionLineItemId: $subscriptionLineItemId) {
          userErrors { field message }
          appUsageRecord { id }
        }
      }`,
      {
        variables: {
          description,
          price: {
            amount: price,
            currencyCode: "EUR",
          },
          subscriptionLineItemId,
        },
      }
    );

    const data = await response.json();
    if (data.data?.appUsageRecordCreate?.userErrors?.length > 0) {
      console.error("[SAR/Billing] Usage record creation failed:", data.data.appUsageRecordCreate.userErrors);
      return false;
    }
    
    console.log(`[SAR/Billing] Created usage record for ${price}€: ${description}`);
    return true;
  } catch (err) {
    console.error("[SAR/Billing] GraphQL error in createUsageRecord:", err);
    return false;
  }
}

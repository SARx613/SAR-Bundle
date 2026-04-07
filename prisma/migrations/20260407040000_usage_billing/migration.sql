-- AlterTable ShopBilling
ALTER TABLE "ShopBilling" 
  DROP COLUMN "activePlan",
  ADD COLUMN "subscriptionLineItemId" TEXT,
  ADD COLUMN "charged200" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "charged1200" BOOLEAN NOT NULL DEFAULT false;

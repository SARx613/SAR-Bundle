-- CreateEnum
CREATE TYPE "BundlePricingMode" AS ENUM ('STANDARD', 'FIXED_PRICE_BOX', 'TIERED', 'PREDEFINED_SIZES');

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN "bundlePricingMode" "BundlePricingMode" NOT NULL DEFAULT 'STANDARD';
ALTER TABLE "Bundle" ADD COLUMN "fixedBoxItemCount" INTEGER;
ALTER TABLE "Bundle" ADD COLUMN "pricingModeMedia" JSONB;

-- Backfill from legacy pricingScope / discountValueType
UPDATE "Bundle" SET "bundlePricingMode" = 'TIERED' WHERE "pricingScope" = 'TIERED';
UPDATE "Bundle" SET "bundlePricingMode" = 'FIXED_PRICE_BOX' WHERE "pricingScope" = 'FLAT' AND "discountValueType" = 'FIXED_PRICE';

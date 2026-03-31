-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PricingScope" AS ENUM ('FLAT', 'TIERED');

-- CreateEnum
CREATE TYPE "DiscountValueType" AS ENUM ('PERCENT', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "ThresholdBasis" AS ENUM ('ITEM_COUNT', 'CART_VALUE');

-- CreateEnum
CREATE TYPE "StepRuleMetric" AS ENUM ('BUNDLE_PRICE', 'TOTAL_ITEM_COUNT', 'VARIANT_QUANTITY', 'DISTINCT_VARIANT_COUNT');

-- CreateEnum
CREATE TYPE "StepRuleOperator" AS ENUM ('LT', 'LTE', 'EQ', 'GTE', 'GT');

-- CreateEnum
CREATE TYPE "LineItemPropertyFieldType" AS ENUM ('CHECKBOX', 'TEXT');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'UNLISTED');

-- CreateEnum
CREATE TYPE "BundlePricingMode" AS ENUM ('STANDARD', 'FIXED_PRICE_BOX', 'TIERED', 'PREDEFINED_SIZES');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "bundleUid" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageGid" TEXT,
    "bundleGallery" JSONB,
    "shopifyProductId" TEXT,
    "shopifyParentVariantId" TEXT,
    "productHandle" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "storefrontDesign" JSONB,
    "status" "BundleStatus" NOT NULL DEFAULT 'DRAFT',
    "bundlePricingMode" "BundlePricingMode" NOT NULL DEFAULT 'STANDARD',
    "fixedBoxItemCount" INTEGER,
    "pricingModeMedia" JSONB,
    "pricingScope" "PricingScope" NOT NULL,
    "discountValueType" "DiscountValueType" NOT NULL,
    "flatDiscountValue" DECIMAL(65,30),
    "showCompareAtPrice" BOOLEAN NOT NULL DEFAULT true,
    "showFixedPriceOnLoad" BOOLEAN NOT NULL DEFAULT false,
    "allowZeroTotal" BOOLEAN NOT NULL DEFAULT false,
    "minTotalItemCount" INTEGER,
    "maxTotalItemCount" INTEGER,
    "minBundleCartValue" DECIMAL(65,30),
    "maxBundleCartValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundlePricingTier" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "thresholdBasis" "ThresholdBasis" NOT NULL,
    "thresholdMin" DECIMAL(65,30) NOT NULL,
    "thresholdMax" DECIMAL(65,30),
    "tierValue" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "BundlePricingTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleStep" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageGid" TEXT,
    "isFinalStep" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BundleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepProduct" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER,
    "maxQuantity" INTEGER,
    "productHandle" TEXT,
    "layoutPreset" TEXT NOT NULL DEFAULT 'STACK_ADD_TO_QTY',
    "styleOverrides" JSONB,

    CONSTRAINT "StepProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepRule" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metric" "StepRuleMetric" NOT NULL,
    "operator" "StepRuleOperator" NOT NULL,
    "value" DECIMAL(65,30) NOT NULL,
    "targetVariantGid" TEXT,

    CONSTRAINT "StepRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepLineItemProperty" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fieldType" "LineItemPropertyFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "propertyKey" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultChecked" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,

    CONSTRAINT "StepLineItemProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_bundleUid_key" ON "Bundle"("bundleUid");

-- CreateIndex
CREATE INDEX "Bundle_shopDomain_idx" ON "Bundle"("shopDomain");

-- CreateIndex
CREATE INDEX "BundlePricingTier_bundleId_sortOrder_idx" ON "BundlePricingTier"("bundleId", "sortOrder");

-- CreateIndex
CREATE INDEX "BundleStep_bundleId_sortOrder_idx" ON "BundleStep"("bundleId", "sortOrder");

-- CreateIndex
CREATE INDEX "StepProduct_stepId_sortOrder_idx" ON "StepProduct"("stepId", "sortOrder");

-- CreateIndex
CREATE INDEX "StepRule_stepId_sortOrder_idx" ON "StepRule"("stepId", "sortOrder");

-- CreateIndex
CREATE INDEX "StepLineItemProperty_stepId_sortOrder_idx" ON "StepLineItemProperty"("stepId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BundlePricingTier" ADD CONSTRAINT "BundlePricingTier_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleStep" ADD CONSTRAINT "BundleStep_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepProduct" ADD CONSTRAINT "StepProduct_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepRule" ADD CONSTRAINT "StepRule_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepLineItemProperty" ADD CONSTRAINT "StepLineItemProperty_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;


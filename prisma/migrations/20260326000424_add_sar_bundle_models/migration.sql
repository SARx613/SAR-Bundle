-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleUid" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageGid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pricingScope" TEXT NOT NULL,
    "discountValueType" TEXT NOT NULL,
    "flatDiscountValue" DECIMAL,
    "showCompareAtPrice" BOOLEAN NOT NULL DEFAULT true,
    "showFixedPriceOnLoad" BOOLEAN NOT NULL DEFAULT false,
    "allowZeroTotal" BOOLEAN NOT NULL DEFAULT false,
    "minTotalItemCount" INTEGER,
    "maxTotalItemCount" INTEGER,
    "minBundleCartValue" DECIMAL,
    "maxBundleCartValue" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BundlePricingTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "thresholdBasis" TEXT NOT NULL,
    "thresholdMin" DECIMAL NOT NULL,
    "thresholdMax" DECIMAL,
    "tierValue" DECIMAL NOT NULL,
    CONSTRAINT "BundlePricingTier_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BundleStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageGid" TEXT,
    "isFinalStep" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BundleStep_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StepProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER,
    "maxQuantity" INTEGER,
    CONSTRAINT "StepProduct_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StepRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "targetVariantGid" TEXT,
    CONSTRAINT "StepRule_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StepLineItemProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fieldType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "propertyKey" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultChecked" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    CONSTRAINT "StepLineItemProperty_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BundleStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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

-- CreateTable
CREATE TABLE "ShopBilling" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "activePlan" TEXT NOT NULL DEFAULT 'free_tier',
    "monthlyBundleRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "revenueResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopBilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopBilling_shopDomain_key" ON "ShopBilling"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopBilling_shopDomain_idx" ON "ShopBilling"("shopDomain");

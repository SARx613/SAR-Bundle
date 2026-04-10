-- CreateTable
CREATE TABLE "TranslationOverride" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "TranslationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationOverride_shopDomain_key_key" ON "TranslationOverride"("shopDomain", "key");

-- CreateIndex
CREATE INDEX "TranslationOverride_shopDomain_idx" ON "TranslationOverride"("shopDomain");

-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN "productHandle" TEXT;
ALTER TABLE "Bundle" ADD COLUMN "seoTitle" TEXT;
ALTER TABLE "Bundle" ADD COLUMN "seoDescription" TEXT;
ALTER TABLE "Bundle" ADD COLUMN "storefrontDesign" JSONB;

-- AlterTable
ALTER TABLE "StepProduct" ADD COLUMN "productHandle" TEXT;
ALTER TABLE "StepProduct" ADD COLUMN "layoutPreset" TEXT NOT NULL DEFAULT 'STACK_ADD_TO_QTY';
ALTER TABLE "StepProduct" ADD COLUMN "styleOverrides" JSONB;

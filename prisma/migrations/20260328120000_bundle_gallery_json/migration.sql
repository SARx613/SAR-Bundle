-- AlterTable
ALTER TABLE "Bundle" ADD COLUMN "bundleGallery" JSONB;

UPDATE "Bundle"
SET "bundleGallery" = jsonb_build_array(
  jsonb_build_object(
    'url', "imageUrl",
    'mediaGid', "imageGid"
  )
)
WHERE "imageUrl" IS NOT NULL
  AND trim("imageUrl") <> ''
  AND "imageUrl" ~ '^https?://';

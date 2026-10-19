import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadImageToShopifyFiles } from "../utils/shopify-file-upload.server";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  const fd = await request.formData();
  const rawImageUrl = fd.get("imageUrl");
  if (typeof rawImageUrl === "string" && rawImageUrl.trim()) {
    const trimmedUrl = rawImageUrl.trim();
    if (!/^https:\/\//i.test(trimmedUrl)) {
      return json(
        { ok: false, error: "Image URL must start with https://" },
        { status: 400 },
      );
    }
    return json({ ok: true, imageUrl: trimmedUrl, imageGid: null });
  }

  const file = fd.get("file");
  if (!file || !(file instanceof File)) {
    return json({ ok: false, error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    return json(
      {
        ok: false,
        error: `Unsupported image type (${file.type || "unknown"}). Allowed: JPEG, PNG, WEBP, GIF, AVIF, SVG.`,
      },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return json(
      {
        ok: false,
        error: "File exceeds maximum allowed size of 20 MB.",
      },
      { status: 400 },
    );
  }

  try {
    const { url, gid } = await uploadImageToShopifyFiles(admin, file);
    return json({ ok: true, imageUrl: url, imageGid: gid });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    console.error("[SAR] Upload error:", msg);
    return json({ ok: false, error: msg }, { status: 500 });
  }
}

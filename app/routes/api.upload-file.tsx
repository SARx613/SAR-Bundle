import { type ActionFunctionArgs, json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { uploadImageToShopifyFiles } from "../utils/shopify-file-upload.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  const fd = await request.formData();
  const file = fd.get("file");
  if (!file || !(file instanceof File)) {
    return json({ ok: false, error: "No file uploaded" }, { status: 400 });
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

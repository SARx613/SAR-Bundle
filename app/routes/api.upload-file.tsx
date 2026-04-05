import { type ActionFunctionArgs, json } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const fd = await request.formData();
  const file = fd.get("file");

  if (!file || !(file instanceof File)) {
    return json({ ok: false, error: "No file uploaded" }, { status: 400 });
  }

  // To avoid complex persistent storage logic per Shopify environment,
  // we return a data URL since banner images are typically small enough 
  // (or we can just accept them without needing S3 buckets).
  // For production environments, this should create a StagedUpload on Shopify.
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/jpeg";
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    return json({ ok: true, imageUrl: dataUrl, imageGid: null });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown upload error";
    console.error("Upload error:", msg);
    return json({ ok: false, error: msg }, { status: 500 });
  }
}

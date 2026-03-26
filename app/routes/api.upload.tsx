import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const MAX_BYTES = 5 * 1024 * 1024;

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const urlField = formData.get("imageUrl");
  const file = formData.get("file");

  if (
    typeof urlField === "string" &&
    urlField.trim().startsWith("http") &&
    (!(file instanceof File) || file.size === 0)
  ) {
    return json({
      ok: true,
      source: "url" as const,
      imageUrl: urlField.trim(),
      imageGid: null,
    });
  }

  if (!(file instanceof File) || file.size === 0) {
    return json(
      { error: "Provide a non-empty file or an imageUrl field" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return json({ error: "File exceeds 5MB limit" }, { status: 400 });
  }

  const filename = file.name || "upload.bin";
  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());

  const resource =
    mimeType.startsWith("image/") ? "IMAGE" : "FILE";

  try {
    const stagedRes = await admin.graphql(
      `#graphql
        mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          input: [
            {
              filename,
              mimeType,
              resource,
              httpMethod: "POST",
            },
          ],
        },
      },
    );

    const stagedJson = await stagedRes.json();
    const stagedData = stagedJson?.data?.stagedUploadsCreate;
    const userErrors = stagedData?.userErrors;
    if (userErrors?.length) {
      return json(
        { error: "stagedUploadsCreate failed", userErrors },
        { status: 400 },
      );
    }

    const target = stagedData?.stagedTargets?.[0] as StagedTarget | undefined;
    if (!target?.url || !target.resourceUrl) {
      return json(
        { error: "No staged upload target returned", raw: stagedJson },
        { status: 502 },
      );
    }

    const uploadForm = new FormData();
    for (const p of target.parameters ?? []) {
      uploadForm.append(p.name, p.value);
    }
    uploadForm.append(
      "file",
      new Blob([buffer], { type: mimeType }),
      filename,
    );

    const putRes = await fetch(target.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      return json(
        {
          error: "Upload to staged URL failed",
          status: putRes.status,
          body: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const fileCreateRes = await admin.graphql(
      `#graphql
        mutation FileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              ... on MediaImage {
                id
                image {
                  url
                }
              }
              ... on GenericFile {
                id
                url
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        variables: {
          files: [
            {
              originalSource: target.resourceUrl,
              contentType: resource === "IMAGE" ? "IMAGE" : "FILE",
            },
          ],
        },
      },
    );

    const fileJson = await fileCreateRes.json();
    const fc = fileJson?.data?.fileCreate;
    if (fc?.userErrors?.length) {
      return json(
        { error: "fileCreate failed", userErrors: fc.userErrors },
        { status: 400 },
      );
    }

    const created = fc?.files?.[0];
    const imageGid: string | null = created?.id ?? null;
    let imageUrl: string | null =
      created?.image?.url ?? created?.url ?? null;

    return json({
      ok: true,
      source: "shopify" as const,
      imageGid,
      imageUrl,
      raw: created,
    });
  } catch (e) {
    console.error("api.upload error", e);
    return json(
      { error: "Upload failed", details: String(e) },
      { status: 500 },
    );
  }
};

export default function ApiUploadStub() {
  return (
    <pre>
      POST multipart here with field &quot;file&quot; (max 5MB) or &quot;imageUrl&quot; for URL
      passthrough.
    </pre>
  );
}

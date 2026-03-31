import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/** Aligné sur la doc Shopify MediaImage (max 20 Mo). */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_OTHER_BYTES = 10 * 1024 * 1024;

type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type AdminFromAuth = Awaited<
  ReturnType<typeof authenticate.admin>
>["admin"];

/**
 * Après fileCreate, Shopify traite le fichier en async : l’URL CDN n’apparaît
 * souvent qu’une fois fileStatus = READY (voir doc « Poll for file readiness »).
 */
async function pollShopifyFileCdnUrl(
  admin: AdminFromAuth,
  fileGid: string,
): Promise<string | null> {
  const maxAttempts = 45;
  const delayMs = 600;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await admin.graphql(
      `#graphql
        query PollShopifyFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              fileStatus
              image {
                url
              }
              preview {
                image {
                  url
                }
              }
            }
            ... on GenericFile {
              fileStatus
              url
            }
          }
        }`,
      { variables: { id: fileGid } },
    );
    const body = await res.json();
    const node = body?.data?.node as
      | {
          fileStatus?: string;
          image?: { url?: string | null } | null;
          preview?: { image?: { url?: string | null } | null } | null;
          url?: string | null;
        }
      | null
      | undefined;

    if (!node) {
      await sleep(delayMs);
      continue;
    }
    if (node.fileStatus === "FAILED") {
      return null;
    }
    const u1 = node.image?.url?.trim();
    const u2 = node.preview?.image?.url?.trim();
    const u3 = typeof node.url === "string" ? node.url.trim() : "";
    const url = u1 || u2 || u3 || "";
    if (url) {
      return url;
    }
    await sleep(delayMs);
  }
  return null;
}

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

  const mimeType = file.type || "application/octet-stream";
  const isImage = mimeType.startsWith("image/");
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_OTHER_BYTES;
  if (file.size > maxBytes) {
    return json(
      {
        error: isImage
          ? "Image trop volumineuse (max 20 Mo, formats Shopify : PNG, GIF, JPEG, WEBP, HEIC)"
          : "Fichier trop volumineux",
      },
      { status: 400 },
    );
  }

  const filename = file.name || "upload.bin";
  const buffer = Buffer.from(await file.arrayBuffer());
  const resource = isImage ? "IMAGE" : "FILE";

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
            isImage
              ? {
                  filename,
                  mimeType,
                  resource,
                  httpMethod: "PUT",
                }
              : {
                  filename,
                  mimeType,
                  resource,
                  httpMethod: "POST",
                  fileSize: String(buffer.length),
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

    if (isImage) {
      const headers = new Headers();
      for (const p of target.parameters ?? []) {
        headers.set(p.name, p.value);
      }
      const putRes = await fetch(target.url, {
        method: "PUT",
        headers,
        body: buffer,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => "");
        return json(
          {
            error: "Upload vers l’URL de staging (PUT) a échoué",
            status: putRes.status,
            body: text.slice(0, 500),
          },
          { status: 502 },
        );
      }
    } else {
      const uploadForm = new FormData();
      for (const p of target.parameters ?? []) {
        uploadForm.append(p.name, p.value);
      }
      uploadForm.append(
        "file",
        new Blob([buffer], { type: mimeType }),
        filename,
      );
      const postRes = await fetch(target.url, {
        method: "POST",
        body: uploadForm,
      });
      if (!postRes.ok) {
        const text = await postRes.text().catch(() => "");
        return json(
          {
            error: "Upload vers l’URL de staging a échoué",
            status: postRes.status,
            body: text.slice(0, 500),
          },
          { status: 502 },
        );
      }
    }

    const fileCreateRes = await admin.graphql(
      `#graphql
        mutation FileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              ... on MediaImage {
                id
                fileStatus
                image {
                  url
                }
              }
              ... on GenericFile {
                id
                fileStatus
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

    const created = fc?.files?.[0] as
      | {
          id?: string;
          fileStatus?: string;
          image?: { url?: string | null };
          url?: string | null;
        }
      | undefined;

    const imageGid: string | null = created?.id ?? null;
    let imageUrl: string | null =
      created?.image?.url?.trim() ||
      (typeof created?.url === "string" ? created.url.trim() : "") ||
      null;

    if (imageGid && !imageUrl) {
      imageUrl = await pollShopifyFileCdnUrl(admin, imageGid);
    }

    if (!imageUrl) {
      return json(
        {
          error:
            "L’image est en cours de traitement côté Shopify ou la récupération de l’URL a échoué. Réessayez dans quelques secondes.",
          imageGid,
          fileStatus: created?.fileStatus ?? null,
        },
        { status: 502 },
      );
    }

    return json({
      ok: true,
      source: "shopify" as const,
      imageGid,
      imageUrl,
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
      POST multipart here with field &quot;file&quot; (images max 20MB) or
      &quot;imageUrl&quot; for URL passthrough.
    </pre>
  );
}

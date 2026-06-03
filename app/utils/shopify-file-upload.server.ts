/**
 * Upload d'image vers Shopify Files (CDN) via le flux officiel en 3 étapes :
 *   1. stagedUploadsCreate  → cible de dépôt temporaire (URL + paramètres)
 *   2. POST des octets       → vers la cible (stockage cloud)
 *   3. fileCreate            → crée le MediaImage à partir de la resourceUrl
 *   4. polling               → attend que l'image soit READY et récupère l'URL CDN
 *
 * Remplace l'ancien hack base64 (data URL inline dans le JSON du design), qui
 * alourdissait les sauvegardes, dépassait les limites de metafield et ralentissait
 * fortement le rendu de l'aperçu.
 *
 * Nécessite le scope `write_files`.
 */

type AdminGraphql = {
  graphql: (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

export type UploadedImage = { url: string; gid: string };

export async function uploadImageToShopifyFiles(
  admin: AdminGraphql,
  file: File,
): Promise<UploadedImage> {
  const filename = (file.name && file.name.trim()) || `sar-upload-${Date.now()}.png`;
  const mimeType = file.type || "image/png";
  const fileSize = String(file.size);

  // 1. Cible de dépôt temporaire
  const stagedRes = await admin.graphql(
    `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        input: [{ filename, mimeType, fileSize, resource: "IMAGE", httpMethod: "POST" }],
      },
    },
  );
  const stagedBody = (await stagedRes.json()) as any;
  const stagedErrors = stagedBody?.data?.stagedUploadsCreate?.userErrors;
  if (stagedErrors?.length) {
    throw new Error(stagedErrors.map((e: { message: string }) => e.message).join("; "));
  }
  const target = stagedBody?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target?.url || !target?.resourceUrl) {
    throw new Error("stagedUploadsCreate: aucune cible de dépôt retournée");
  }

  // 2. Dépôt des octets sur la cible (le fichier doit être ajouté EN DERNIER)
  const form = new FormData();
  for (const p of target.parameters as Array<{ name: string; value: string }>) {
    form.append(p.name, p.value);
  }
  form.append("file", file, filename);

  const uploadResp = await fetch(target.url, { method: "POST", body: form });
  if (!uploadResp.ok && ![201, 204].includes(uploadResp.status)) {
    throw new Error(`Dépôt du fichier échoué (HTTP ${uploadResp.status})`);
  }

  // 3. Création du MediaImage à partir de la resourceUrl
  const createRes = await admin.graphql(
    `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            ... on MediaImage { image { url } }
          }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        files: [{ alt: filename, contentType: "IMAGE", originalSource: target.resourceUrl }],
      },
    },
  );
  const createBody = (await createRes.json()) as any;
  const createErrors = createBody?.data?.fileCreate?.userErrors;
  if (createErrors?.length) {
    throw new Error(createErrors.map((e: { message: string }) => e.message).join("; "));
  }
  const created = createBody?.data?.fileCreate?.files?.[0];
  if (!created?.id) {
    throw new Error("fileCreate: aucun fichier créé");
  }
  const gid: string = created.id;

  // 4. Polling jusqu'à obtention de l'URL CDN (l'image passe par UPLOADED → READY)
  let url: string = created.image?.url || "";
  for (let i = 0; i < 8 && !url; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const pollRes = await admin.graphql(
      `#graphql
        query SarFileUrl($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              fileStatus
              image { url }
              preview { image { url } }
            }
          }
        }`,
      { variables: { id: gid } },
    );
    const pollBody = (await pollRes.json()) as any;
    const node = pollBody?.data?.node;
    url = node?.image?.url || node?.preview?.image?.url || "";
  }

  if (!url) {
    throw new Error("Traitement de l'image trop long (Shopify n'a pas renvoyé d'URL)");
  }

  return { url, gid };
}

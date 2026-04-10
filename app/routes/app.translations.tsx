import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Banner,
  Badge,
  IndexTable,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  TRANSLATION_KEYS,
  DEFAULT_TRANSLATIONS,
  detectLanguageFromLocale,
} from "../utils/translations";

/* ─────────────────── Loader ─────────────────── */

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let overrides: { key: string; value: string }[] = [];
  try {
    overrides = await (prisma as any).translationOverride.findMany({
      where: { shopDomain: shop },
    });
  } catch {
    // Table may not exist yet if migration hasn't run
  }

  const overrideMap: Record<string, string> = {};
  for (const ov of overrides) {
    overrideMap[ov.key] = ov.value;
  }

  // Detect shop language from session locale
  const shopLocale = (session as any).locale ?? null;
  const detectedLang = detectLanguageFromLocale(shopLocale);

  return json({
    overrideMap,
    shopLocale: shopLocale ?? "en",
    detectedLang,
  });
};

/* ─────────────────── Action ─────────────────── */

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const rawEntries = formData.get("translations");

  if (typeof rawEntries !== "string") {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  let entries: Record<string, string>;
  try {
    entries = JSON.parse(rawEntries);
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Upsert each translation
  const validKeys = TRANSLATION_KEYS.map((k) => k.key);
  const ops = [];
  const db = prisma as any;

  for (const [key, value] of Object.entries(entries)) {
    if (!validKeys.includes(key)) continue;
    const trimmed = (value ?? "").trim();

    if (trimmed) {
      ops.push(
        db.translationOverride.upsert({
          where: { shopDomain_key: { shopDomain: shop, key } },
          create: { shopDomain: shop, key, value: trimmed },
          update: { value: trimmed },
        }),
      );
    } else {
      // Empty = delete override (fall back to default)
      ops.push(
        db.translationOverride.deleteMany({
          where: { shopDomain: shop, key },
        }),
      );
    }
  }

  try {
    if (ops.length > 0) {
      await (prisma as any).$transaction(ops);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("translations save error:", message);
    return json({ error: `Erreur lors de la sauvegarde : ${message}` }, { status: 500 });
  }

  return json({ ok: true });
};

/* ─────────────────── Component ─────────────────── */

const LANG_LABELS: Record<string, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
};

export default function TranslationsPage() {
  const { overrideMap, detectedLang } = useLoaderData<typeof loader>();
  const actionData = useActionData<{ ok?: boolean; error?: string }>();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSaving = nav.state === "submitting";

  const defaults = DEFAULT_TRANSLATIONS[detectedLang] ?? DEFAULT_TRANSLATIONS.en;
  const enDefaults = DEFAULT_TRANSLATIONS.en;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const tk of TRANSLATION_KEYS) {
      init[tk.key] = overrideMap[tk.key] ?? "";
    }
    return init;
  });

  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    const fd = new FormData();
    fd.set("translations", JSON.stringify(values));
    submit(fd, { method: "post" });
    setSaved(true);
  }, [values, submit]);

  const handleReset = useCallback(() => {
    const empty: Record<string, string> = {};
    for (const tk of TRANSLATION_KEYS) {
      empty[tk.key] = "";
    }
    setValues(empty);
    setSaved(false);
  }, []);

  const resourceName = {
    singular: "translation",
    plural: "translations",
  };

  const rowMarkup = TRANSLATION_KEYS.map((tk, index) => {
    const defaultText = defaults[tk.key] ?? enDefaults[tk.key] ?? "";
    const currentValue = values[tk.key] ?? "";

    return (
      <IndexTable.Row id={tk.key} key={tk.key} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {tk.contextFr}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {tk.context}
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="100">
            <Text as="span" variant="bodyMd">
              {defaultText}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              clé: <code>{tk.key}</code>
            </Text>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <TextField
            label=""
            labelHidden
            value={currentValue}
            onChange={(val) => handleChange(tk.key, val)}
            placeholder={defaultText}
            autoComplete="off"
          />
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page>
      <TitleBar title="Textes & Langues" />
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            Personnalisez les textes du bundle affichés sur votre boutique.
            Si un champ est laissé vide, la traduction par défaut de votre langue
            sera utilisée ({LANG_LABELS[detectedLang] ?? detectedLang}).
          </p>
        </Banner>

        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Box padding="400" paddingBlockEnd="0">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Traductions personnalisées
                    </Text>
                    <InlineStack gap="200">
                      <Badge tone="info">
                        {`Langue détectée : ${LANG_LABELS[detectedLang] ?? detectedLang}`}
                      </Badge>
                      <Badge>
                        {`${Object.values(values).filter((v) => v.trim()).length} / ${TRANSLATION_KEYS.length} personnalisées`}
                      </Badge>
                    </InlineStack>
                  </BlockStack>
                  <InlineStack gap="200">
                    <Button onClick={handleReset} disabled={isSaving}>
                      Tout réinitialiser
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      loading={isSaving}
                    >
                      Enregistrer
                    </Button>
                  </InlineStack>
                </InlineStack>
              </Box>
              <IndexTable
                resourceName={resourceName}
                itemCount={TRANSLATION_KEYS.length}
                headings={[
                  { title: "Contexte" },
                  { title: "Texte par défaut" },
                  { title: "Votre traduction" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>

        {actionData?.error && (
          <Banner tone="critical" title="Erreur">
            <p>{actionData.error}</p>
          </Banner>
        )}
        {saved && !isSaving && actionData?.ok && (
          <Banner tone="success" onDismiss={() => setSaved(false)}>
            <p>Traductions enregistrées avec succès !</p>
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}

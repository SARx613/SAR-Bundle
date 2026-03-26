import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  EmptyState,
  Badge,
  Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

type BundleRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rows = await prisma.bundle.findMany({
    where: { shopDomain: session.shop },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const bundles: BundleRow[] = rows.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  }));
  return json({ bundles });
};

const statusTone: Record<
  string,
  "info" | "success" | "attention" | "warning" | "critical" | "new" | "read-only"
> = {
  DRAFT: "info",
  ACTIVE: "success",
  ARCHIVED: "read-only",
};

export default function AppBundles() {
  const { bundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const resourceName = {
    singular: "bundle",
    plural: "bundles",
  };

  const rowMarkup = bundles.map(({ id, name, status, createdAt }, index) => (
    <IndexTable.Row id={id} key={id} position={index}>
      <IndexTable.Cell>
        <Button variant="plain" onClick={() => navigate(`/app/bundle/${id}`)}>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {name}
          </Text>
        </Button>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={statusTone[status] ?? "info"}>{status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {new Date(createdAt).toLocaleString()}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page>
      <TitleBar title="SAR Bundles">
        <button
          variant="primary"
          onClick={() => navigate("/app/bundle/new")}
        >
          Créer un bundle
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card>
            {bundles.length === 0 ? (
              <EmptyState
                heading="Créez votre premier bundle"
                action={{
                  content: "Créer un bundle",
                  onAction: () => navigate("/app/bundle/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Les bundles par étapes apparaîtront ici une fois configurés.
                </p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={bundles.length}
                headings={[
                  { title: "Nom" },
                  { title: "Statut" },
                  { title: "Date de création" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

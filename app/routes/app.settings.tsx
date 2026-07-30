import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getIntegration, getOdooApiKey, saveIntegration } from "../lib/integration.server";
import { testOdoo } from "../lib/odoo.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const integ = await getIntegration(session.shop);

  let locations: { id: string; name: string }[] = [];
  try {
    const resp = await admin.graphql(
      `#graphql
        query { locations(first: 50) { nodes { id name } } }`,
    );
    const j: any = await resp.json();
    locations = j?.data?.locations?.nodes ?? [];
  } catch {
    /* locations are a convenience; ignore failures */
  }

  return { integ, locations };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  const odooUrl = String(form.get("odooUrl") ?? "").trim();
  const odooDb = String(form.get("odooDb") ?? "").trim();
  const odooLogin = String(form.get("odooLogin") ?? "").trim();
  const odooKey = String(form.get("odooKey") ?? "");

  if (intent === "test") {
    const key = odooKey.trim() || (await getOdooApiKey(session.shop)) || "";
    if (!odooUrl || !odooDb || !odooLogin || !key) {
      return {
        tested: true,
        testResult: { ok: false, error: "Fill in URL, database, login and API key first." },
      };
    }
    const testResult = await testOdoo({ url: odooUrl, db: odooDb, login: odooLogin, apiKey: key });
    return { tested: true, testResult };
  }

  if (intent === "save") {
    await saveIntegration(session.shop, { odooUrl, odooDb, odooLogin, odooKey });
    return { saved: true };
  }

  return {};
}

export default function SettingsPage() {
  const { integ, locations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  const [odooUrl, setOdooUrl] = useState(integ.odooUrl);
  const [odooDb, setOdooDb] = useState(integ.odooDb);
  const [odooLogin, setOdooLogin] = useState(integ.odooLogin);
  const [odooKey, setOdooKey] = useState("");

  const test = actionData?.testResult;

  return (
    <Page>
      <TitleBar title="Integrations" />
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Odoo connection
                  </Text>
                  <Text as="p" tone="subdued">
                    StockPromise can read live stock straight from your Odoo warehouses.
                    Create an API key in Odoo (developer mode → your user → API Keys).
                  </Text>
                </BlockStack>

                {actionData?.saved && <Banner tone="success">Saved.</Banner>}
                {test && test.ok && (
                  <Banner tone="success">Connected to Odoo ✓ (user id {test.uid}).</Banner>
                )}
                {test && !test.ok && <Banner tone="critical">{test.error}</Banner>}

                <TextField
                  label="Odoo URL"
                  value={odooUrl}
                  onChange={setOdooUrl}
                  name="odooUrl"
                  placeholder="https://yourcompany.odoo.com"
                  autoComplete="off"
                />
                <TextField
                  label="Database name"
                  value={odooDb}
                  onChange={setOdooDb}
                  name="odooDb"
                  autoComplete="off"
                />
                <TextField
                  label="Login (user email)"
                  value={odooLogin}
                  onChange={setOdooLogin}
                  name="odooLogin"
                  autoComplete="off"
                />
                <TextField
                  label="API key"
                  value={odooKey}
                  onChange={setOdooKey}
                  name="odooKey"
                  type="password"
                  autoComplete="off"
                  helpText={
                    integ.hasKey
                      ? "A key is already saved — leave blank to keep it, or enter a new one to replace it."
                      : "Stored encrypted."
                  }
                />

                <InlineStack gap="300">
                  <Button submit name="intent" value="save" variant="primary" loading={busy}>
                    Save
                  </Button>
                  <Button submit name="intent" value="test" loading={busy}>
                    Test connection
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Your Shopify locations
              </Text>
              <Text as="p" tone="subdued">
                Use these IDs as <code>shopifyLocationId</code> for each warehouse in Delivery rules.
              </Text>
              {locations.length === 0 && (
                <Text as="p" tone="subdued">
                  No locations found (or not yet installed on a store).
                </Text>
              )}
              {locations.map((loc) => (
                <BlockStack gap="050" key={loc.id}>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {loc.name}
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm" breakWord>
                    {loc.id}
                  </Text>
                </BlockStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

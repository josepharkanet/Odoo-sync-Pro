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
  Select,
  Checkbox,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getIntegration, getOdooApiKey, saveIntegration } from "../lib/integration.server";
import { testOdoo } from "../lib/odoo.server";
import { odooStockCheck, recentSyncs } from "../lib/odoo-sync.server";

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

  const syncs = await recentSyncs(session.shop, 10);
  return { integ, locations, syncs };
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
    const matchBy = form.get("matchBy") === "sku" ? "sku" : "barcode";
    const pushOrders = form.get("pushOrders") === "on";
    await saveIntegration(session.shop, { odooUrl, odooDb, odooLogin, odooKey, matchBy, pushOrders });
    return { saved: true };
  }

  if (intent === "stockcheck") {
    const value = String(form.get("stockValue") ?? "").trim();
    if (!value) return { stock: { ok: false, error: "Enter a barcode or SKU to look up." } };
    const stock = await odooStockCheck(session.shop, value);
    return { stock };
  }

  return {};
}

export default function SettingsPage() {
  const { integ, locations, syncs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  const [odooUrl, setOdooUrl] = useState(integ.odooUrl);
  const [odooDb, setOdooDb] = useState(integ.odooDb);
  const [odooLogin, setOdooLogin] = useState(integ.odooLogin);
  const [odooKey, setOdooKey] = useState("");
  const [matchBy, setMatchBy] = useState<string>(integ.matchBy);
  const [pushOrders, setPushOrders] = useState<boolean>(integ.pushOrders);
  const [stockValue, setStockValue] = useState("");

  const test = actionData?.testResult;
  const stock = actionData?.stock;

  return (
    <Page>
      <TitleBar title="Odoo integration" />
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <input type="hidden" name="matchBy" value={matchBy} />
              <input type="hidden" name="pushOrders" value={pushOrders ? "on" : "off"} />
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Odoo connection
                  </Text>
                  <Text as="p" tone="subdued">
                    Connect your Odoo so this app can read live warehouse stock and create a
                    sale order in Odoo for every new Shopify order. Create an API key in Odoo
                    (Settings → Users → your API user → New API Key, developer mode on).
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

                <Divider />

                <Select
                  label="Match Shopify products to Odoo by"
                  options={[
                    { label: "Barcode", value: "barcode" },
                    { label: "SKU / internal reference", value: "sku" },
                  ]}
                  value={matchBy}
                  onChange={setMatchBy}
                  helpText="Barcode → Odoo barcode. SKU → Odoo internal reference (default_code)."
                />
                <Checkbox
                  label="Create an Odoo sale order for each new Shopify order"
                  checked={pushOrders}
                  onChange={setPushOrders}
                  helpText="Turn off to pause order pushing without disconnecting Odoo."
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
                Use these IDs as <code>shopifyLocationId</code> for each warehouse in Delivery
                rules, and set each warehouse&apos;s <code>odooWarehouseId</code> there too.
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

        <Layout.Section>
          <Card>
            <Form method="post">
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Check Odoo stock
                </Text>
                <Text as="p" tone="subdued">
                  Look up a product by {integ.matchBy} and see its on-hand quantity in each
                  mapped warehouse. Proves the connection reads real Odoo stock.
                </Text>
                <InlineStack gap="300" blockAlign="end">
                  <div style={{ minWidth: 260 }}>
                    <TextField
                      label={integ.matchBy === "sku" ? "SKU" : "Barcode"}
                      labelHidden
                      value={stockValue}
                      onChange={setStockValue}
                      name="stockValue"
                      placeholder={integ.matchBy === "sku" ? "Internal reference" : "Barcode"}
                      autoComplete="off"
                    />
                  </div>
                  <Button submit name="intent" value="stockcheck" loading={busy}>
                    Look up
                  </Button>
                </InlineStack>

                {stock && !stock.ok && <Banner tone="critical">{stock.error}</Banner>}
                {stock && stock.ok && (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {stock.product.name}
                      {stock.product.barcode ? ` · ${stock.product.barcode}` : ""}
                    </Text>
                    {stock.byWarehouse.map((w: any) => (
                      <InlineStack key={w.id} gap="200" align="space-between">
                        <Text as="span">
                          {w.name}
                          {!w.mapped ? " (no odooWarehouseId set)" : ""}
                        </Text>
                        <Text as="span" fontWeight="semibold">
                          {w.mapped ? `${w.qty} in stock` : "—"}
                        </Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Recent order syncs
              </Text>
              {syncs.length === 0 && (
                <Text as="p" tone="subdued">
                  No orders synced yet. New Shopify orders will appear here once Odoo is connected.
                </Text>
              )}
              {syncs.map((s: any) => (
                <InlineStack key={s.shopifyOrderId} gap="300" align="space-between" blockAlign="center">
                  <BlockStack gap="050">
                    <Text as="span" fontWeight="semibold">
                      {s.shopifyOrderName || s.shopifyOrderId}
                    </Text>
                    {s.error && (
                      <Text as="span" tone="subdued" variant="bodySm">
                        {s.error}
                      </Text>
                    )}
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    {s.odooOrderName && <Text as="span" tone="subdued">{s.odooOrderName}</Text>}
                    <Badge tone={s.status === "synced" ? "success" : "critical"}>
                      {s.status === "synced" ? "Synced" : "Error"}
                    </Badge>
                  </InlineStack>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

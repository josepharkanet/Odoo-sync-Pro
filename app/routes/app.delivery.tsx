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
  Badge,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getConfig, saveConfig } from "../lib/config.server";
import { computePromise } from "../lib/engine";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const config = await getConfig(session.shop);
  return { shop: session.shop, configText: JSON.stringify(config, null, 2) };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const configText = String(form.get("configText") ?? "");

  let config: any;
  try {
    config = JSON.parse(configText);
  } catch (e) {
    return { ok: false, error: `Invalid JSON — ${(e as Error).message}`, configText };
  }

  if (intent === "save") {
    await saveConfig(session.shop, config);
    return { ok: true, saved: true, configText };
  }

  if (intent === "preview") {
    const emirate = String(form.get("emirate") ?? "");
    let stock: Record<string, number> = {};
    try {
      stock = JSON.parse(String(form.get("stock") ?? "{}"));
    } catch {
      /* ignore bad stock json — treat as empty */
    }
    const preview = computePromise({
      config,
      stockByWarehouse: stock,
      location: { emirate },
      now: new Date(),
    });
    return { ok: true, preview, configText };
  }

  return { ok: false, error: "Unknown action", configText };
}

function badgeTone(status: string): "success" | "attention" | "info" | "critical" | undefined {
  if (status === "same_day") return "success";
  if (status === "next_day") return "attention";
  if (status === "dated") return "info";
  if (status === "sold_out") return "critical";
  return undefined;
}

export default function DeliveryConfigPage() {
  const { shop, configText: initialConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  const [configText, setConfigText] = useState(actionData?.configText ?? initialConfig);
  const [emirate, setEmirate] = useState("Ajman");
  const [stock, setStock] = useState('{ "wh1": 0, "wh2": 5 }');

  const preview = (actionData as any)?.preview;

  return (
    <Page>
      <TitleBar title="Delivery rules" />
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    Delivery configuration
                  </Text>
                  <Text as="p" tone="subdued">
                    Warehouses, zones, cutoff time, weekend &amp; holidays for {shop}.
                  </Text>
                </BlockStack>

                {(actionData as any)?.error && (
                  <Banner tone="critical">{(actionData as any).error}</Banner>
                )}
                {(actionData as any)?.saved && (
                  <Banner tone="success">Saved — the storefront widget uses this now.</Banner>
                )}

                <TextField
                  label="Config (JSON)"
                  value={configText}
                  onChange={setConfigText}
                  name="configText"
                  multiline={18}
                  autoComplete="off"
                  spellCheck={false}
                />

                <InlineStack gap="300">
                  <Button submit name="intent" value="save" variant="primary" loading={busy}>
                    Save
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Test a promise
                </Text>
                <Text as="p" tone="subdued">
                  See what a shopper would be told, using the config on the left.
                </Text>

                {/* carry the (possibly edited) config into this form too */}
                <input type="hidden" name="configText" value={configText} />

                <TextField
                  label="Customer emirate"
                  value={emirate}
                  onChange={setEmirate}
                  name="emirate"
                  autoComplete="off"
                />
                <TextField
                  label="Stock per warehouse (JSON)"
                  helpText='e.g. { "wh1": 0, "wh2": 5 }'
                  value={stock}
                  onChange={setStock}
                  name="stock"
                  autoComplete="off"
                  spellCheck={false}
                />

                <Button submit name="intent" value="preview" loading={busy}>
                  Preview
                </Button>

                {preview && (
                  <Box
                    padding="400"
                    background="bg-surface-secondary"
                    borderRadius="300"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="200">
                      <Badge tone={badgeTone(preview.status)}>{preview.status}</Badge>
                      <Text as="p" variant="headingLg">
                        {preview.message}
                      </Text>
                      {preview.warehouseName && (
                        <Text as="p" tone="subdued">
                          Fulfilled from {preview.warehouseName}
                        </Text>
                      )}
                      {preview.deliverBy && (
                        <Text as="p" tone="subdued">
                          Deliver by {preview.deliverBy}
                        </Text>
                      )}
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

import type { LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { LogoMark } from "../components/Logo";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const NAVY = "#24305E";

function Step({
  n,
  title,
  desc,
  to,
  cta,
}: {
  n: number;
  title: string;
  desc: string;
  to?: string;
  cta?: string;
}) {
  return (
    <InlineStack gap="400" blockAlign="center" wrap={false}>
      <span
        style={{
          flex: "0 0 auto",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: NAVY,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1 }}>
        <Text as="p" variant="bodyMd" fontWeight="semibold">
          {title}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {desc}
        </Text>
      </div>
      {to && cta ? <Button url={to}>{cta}</Button> : null}
    </InlineStack>
  );
}

export default function Index() {
  return (
    <Page>
      <TitleBar title="Arkanet Odoo Connector" />
      <BlockStack gap="500">
        <Card>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <LogoMark size={52} />
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">
                Arkanet Odoo Connector
              </Text>
              <Text as="p" tone="subdued">
                Stock-aware delivery promises for multi-warehouse stores.
              </Text>
            </BlockStack>
          </InlineStack>
        </Card>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Get started in 3 steps
                </Text>
                <Step
                  n={1}
                  title="Connect your warehouses"
                  desc="Add your Odoo connection, or map your Shopify locations."
                  to="/app/settings"
                  cta="Integrations"
                />
                <Step
                  n={2}
                  title="Set your delivery rules"
                  desc="Zones, nearest-warehouse routing, cutoff time, weekend & holidays."
                  to="/app/delivery"
                  cta="Delivery rules"
                />
                <Step
                  n={3}
                  title="Add the widget to your product page"
                  desc="Theme editor → Add block → Apps → Delivery promise."
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  What shoppers see
                </Text>
                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">Same-day</Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      nearest warehouse has it
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="attention">Delivered by…</Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      ships from further away
                    </Text>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="critical">Sold out</Badge>
                    <Text as="span" tone="subdued" variant="bodySm">
                      none in stock anywhere
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

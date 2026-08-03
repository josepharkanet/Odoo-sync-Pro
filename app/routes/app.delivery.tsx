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
  Select,
  Checkbox,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { getConfig, saveConfig } from "../lib/config.server";
import { computePromise } from "../lib/engine";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const config = await getConfig(session.shop);

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

  return { shop: session.shop, config, locations };
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
    return { ok: false, error: `Could not read the form — ${(e as Error).message}` };
  }

  if (intent === "save") {
    await saveConfig(session.shop, config);
    return { ok: true, saved: true };
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
    return { ok: true, preview };
  }

  return { ok: false, error: "Unknown action" };
}

function badgeTone(status: string): "success" | "attention" | "info" | "critical" | undefined {
  if (status === "same_day") return "success";
  if (status === "next_day") return "attention";
  if (status === "dated") return "info";
  if (status === "sold_out") return "critical";
  return undefined;
}

const WEEKDAYS: [number, string][] = [
  [0, "Sun"],
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
];

// ---- state <-> config shape ----------------------------------------------

function toState(c: any) {
  return {
    timezone: c.timezone || "Asia/Dubai",
    weekend: Array.isArray(c.weekend) ? c.weekend : [5, 6],
    holidays: Array.isArray(c.holidays) ? c.holidays : [],
    cutoffTime: c.cutoffTime || "16:00",
    handlingDays: c.handlingDays ?? 0,
    warehouses: (c.warehouses || []).map((w: any) => ({
      id: w.id,
      name: w.name || "",
      shopifyLocationId: w.shopifyLocationId || "",
      odooWarehouseId: w.odooWarehouseId != null ? String(w.odooWarehouseId) : "",
    })),
    zones: (c.zones || []).map((z: any) => ({
      id: z.id,
      name: z.name || "",
      default: !!z.default,
      emiratesText: (z.match?.emirate || []).join(", "),
      routes: (z.routes || []).map((r: any) => ({ warehouse: r.warehouse, promise: r.promise })),
    })),
  };
}

function toConfig(s: any) {
  return {
    timezone: s.timezone || "Asia/Dubai",
    weekend: [...(s.weekend || [])].sort((a: number, b: number) => a - b),
    holidays: (s.holidays || []).filter(Boolean),
    cutoffTime: s.cutoffTime || "16:00",
    handlingDays: Number(s.handlingDays) || 0,
    warehouses: (s.warehouses || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      shopifyLocationId: w.shopifyLocationId || "",
      ...(String(w.odooWarehouseId || "").trim() !== ""
        ? { odooWarehouseId: Number(w.odooWarehouseId) }
        : {}),
    })),
    zones: (s.zones || []).map((z: any) => ({
      id: z.id,
      name: z.name,
      ...(z.default ? { default: true } : {}),
      match: {
        emirate: String(z.emiratesText || "")
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean),
      },
      routes: (z.routes || []).map((r: any) => ({ warehouse: r.warehouse, promise: r.promise })),
    })),
  };
}

const promiseKind = (p: any) => (p && typeof p === "object" && p.type === "days" ? "days" : "same-day");
const promiseDays = (p: any) => (p && typeof p === "object" ? p.days : 2);

export default function DeliveryConfigPage() {
  const { shop, config: initial, locations } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as any;
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  const [s, setS] = useState<any>(() => toState(initial));
  const [emirate, setEmirate] = useState("Ajman");
  const [stock, setStock] = useState('{ "wh1": 0, "wh2": 5 }');

  const configText = JSON.stringify(toConfig(s));
  const preview = actionData?.preview;

  // ---- updaters ----
  const patch = (p: any) => setS((c: any) => ({ ...c, ...p }));
  const patchWh = (i: number, p: any) =>
    setS((c: any) => {
      const a = [...c.warehouses];
      a[i] = { ...a[i], ...p };
      return { ...c, warehouses: a };
    });
  const patchZone = (i: number, p: any) =>
    setS((c: any) => {
      const a = [...c.zones];
      a[i] = { ...a[i], ...p };
      return { ...c, zones: a };
    });
  const patchRoute = (zi: number, ri: number, p: any) =>
    setS((c: any) => {
      const zs = [...c.zones];
      const rs = [...(zs[zi].routes || [])];
      rs[ri] = { ...rs[ri], ...p };
      zs[zi] = { ...zs[zi], routes: rs };
      return { ...c, zones: zs };
    });

  const toggleDay = (d: number) =>
    setS((c: any) => {
      const set = new Set<number>(c.weekend || []);
      set.has(d) ? set.delete(d) : set.add(d);
      return { ...c, weekend: [...set] };
    });

  const nextId = (arr: any[], prefix: string) => {
    const taken = new Set(arr.map((x) => x.id));
    let n = arr.length + 1;
    while (taken.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };

  const addWarehouse = () =>
    setS((c: any) => {
      const id = nextId(c.warehouses, "wh");
      return {
        ...c,
        warehouses: [...c.warehouses, { id, name: `Warehouse ${c.warehouses.length + 1}`, shopifyLocationId: "", odooWarehouseId: "" }],
      };
    });
  const removeWarehouse = (i: number) =>
    setS((c: any) => ({ ...c, warehouses: c.warehouses.filter((_: any, k: number) => k !== i) }));

  const addZone = () =>
    setS((c: any) => {
      const id = nextId(c.zones, "z");
      return { ...c, zones: [...c.zones, { id, name: "New zone", default: false, emiratesText: "", routes: [] }] };
    });
  const removeZone = (i: number) => setS((c: any) => ({ ...c, zones: c.zones.filter((_: any, k: number) => k !== i) }));

  const addRoute = (zi: number) =>
    setS((c: any) => {
      const zs = [...c.zones];
      const firstWh = c.warehouses[0]?.id || "";
      zs[zi] = { ...zs[zi], routes: [...(zs[zi].routes || []), { warehouse: firstWh, promise: "same-day" }] };
      return { ...c, zones: zs };
    });
  const removeRoute = (zi: number, ri: number) =>
    setS((c: any) => {
      const zs = [...c.zones];
      zs[zi] = { ...zs[zi], routes: zs[zi].routes.filter((_: any, k: number) => k !== ri) };
      return { ...c, zones: zs };
    });

  const addHoliday = () => setS((c: any) => ({ ...c, holidays: [...c.holidays, ""] }));
  const setHoliday = (i: number, v: string) =>
    setS((c: any) => {
      const a = [...c.holidays];
      a[i] = v;
      return { ...c, holidays: a };
    });
  const removeHoliday = (i: number) =>
    setS((c: any) => ({ ...c, holidays: c.holidays.filter((_: any, k: number) => k !== i) }));

  const locationOptions = [{ label: "— not mapped —", value: "" }, ...locations.map((l) => ({ label: l.name, value: l.id }))];
  const whOptions = s.warehouses.map((w: any) => ({ label: w.name || w.id, value: w.id }));

  return (
    <Page>
      <TitleBar title="Delivery rules" />
      <Layout>
        <Layout.Section>
          <Form method="post">
            <input type="hidden" name="configText" value={configText} />
            <BlockStack gap="400">
              {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}
              {actionData?.saved && (
                <Banner tone="success">Saved — the storefront widget and Odoo stock reads use this now.</Banner>
              )}

              {/* --- General --- */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    General
                  </Text>
                  <Text as="p" tone="subdued">
                    Timezone, order cutoff, prep time, and weekend & holidays for {shop}.
                  </Text>

                  <InlineStack gap="400" wrap>
                    <div style={{ minWidth: 200 }}>
                      <TextField label="Timezone" value={s.timezone} onChange={(v) => patch({ timezone: v })} autoComplete="off" />
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <TextField label="Order cutoff" type="time" value={s.cutoffTime} onChange={(v) => patch({ cutoffTime: v })} autoComplete="off" helpText="Orders after this ship next day" />
                    </div>
                    <div style={{ minWidth: 140 }}>
                      <TextField label="Prep days" type="number" min={0} value={String(s.handlingDays)} onChange={(v) => patch({ handlingDays: v })} autoComplete="off" helpText="Days to pack before shipping" />
                    </div>
                  </InlineStack>

                  <BlockStack gap="150">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      Weekend (non-working days)
                    </Text>
                    <InlineStack gap="300" wrap>
                      {WEEKDAYS.map(([d, label]) => (
                        <Checkbox key={d} label={label} checked={(s.weekend || []).includes(d)} onChange={() => toggleDay(d)} />
                      ))}
                    </InlineStack>
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        Holidays (no delivery)
                      </Text>
                      <Button variant="plain" onClick={addHoliday}>
                        Add holiday
                      </Button>
                    </InlineStack>
                    {s.holidays.length === 0 && (
                      <Text as="p" tone="subdued" variant="bodySm">
                        None. Add public holidays so promises skip those dates.
                      </Text>
                    )}
                    {s.holidays.map((h: string, i: number) => (
                      <InlineStack key={i} gap="200" blockAlign="center">
                        <div style={{ minWidth: 200 }}>
                          <TextField label="Holiday" labelHidden type="date" value={h} onChange={(v) => setHoliday(i, v)} autoComplete="off" />
                        </div>
                        <Button variant="plain" tone="critical" onClick={() => removeHoliday(i)}>
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* --- Warehouses --- */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Warehouses
                    </Text>
                    <Button variant="plain" onClick={addWarehouse}>
                      Add warehouse
                    </Button>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    Map each warehouse to its Shopify location (for stock) and its Odoo warehouse id (for Odoo stock reads).
                  </Text>

                  {s.warehouses.length === 0 && (
                    <Text as="p" tone="subdued" variant="bodySm">
                      No warehouses yet. Add your first one.
                    </Text>
                  )}

                  {s.warehouses.map((w: any, i: number) => (
                    <Box key={w.id} padding="300" background="bg-surface-secondary" borderRadius="300" borderWidth="025" borderColor="border">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Badge>{w.id}</Badge>
                          <Button variant="plain" tone="critical" onClick={() => removeWarehouse(i)}>
                            Remove
                          </Button>
                        </InlineStack>
                        <InlineStack gap="400" wrap>
                          <div style={{ minWidth: 200, flex: 1 }}>
                            <TextField label="Name" value={w.name} onChange={(v) => patchWh(i, { name: v })} autoComplete="off" placeholder="e.g. Ajman" />
                          </div>
                          <div style={{ minWidth: 220, flex: 1 }}>
                            <Select label="Shopify location" options={locationOptions} value={w.shopifyLocationId} onChange={(v) => patchWh(i, { shopifyLocationId: v })} />
                          </div>
                          <div style={{ minWidth: 150 }}>
                            <TextField label="Odoo warehouse id" type="number" min={1} value={w.odooWarehouseId} onChange={(v) => patchWh(i, { odooWarehouseId: v })} autoComplete="off" placeholder="e.g. 2" helpText="Inventory → Warehouses" />
                          </div>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>

              {/* --- Zones --- */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Delivery zones
                    </Text>
                    <Button variant="plain" onClick={addZone}>
                      Add zone
                    </Button>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    A zone matches customer emirates to an ordered list of warehouses. The first warehouse with stock wins, and the shopper sees its promise.
                  </Text>

                  {s.zones.length === 0 && (
                    <Text as="p" tone="subdued" variant="bodySm">
                      No zones yet. Add one for your near area, and a default zone for everywhere else.
                    </Text>
                  )}

                  {s.zones.map((z: any, zi: number) => (
                    <Box key={z.id} padding="400" background="bg-surface-secondary" borderRadius="300" borderWidth="025" borderColor="border">
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Badge tone={z.default ? "info" : undefined}>{z.default ? "Default zone" : z.id}</Badge>
                          <Button variant="plain" tone="critical" onClick={() => removeZone(zi)}>
                            Remove
                          </Button>
                        </InlineStack>

                        <InlineStack gap="400" wrap>
                          <div style={{ minWidth: 200, flex: 1 }}>
                            <TextField label="Zone name" value={z.name} onChange={(v) => patchZone(zi, { name: v })} autoComplete="off" />
                          </div>
                          <div style={{ minWidth: 220, flex: 2 }}>
                            <TextField label="Emirates (comma separated)" value={z.emiratesText} onChange={(v) => patchZone(zi, { emiratesText: v })} autoComplete="off" placeholder="Ajman, Sharjah" disabled={z.default} helpText={z.default ? "The default zone matches everywhere else" : undefined} />
                          </div>
                        </InlineStack>

                        <Checkbox label="Use as the default (fallback) zone" checked={z.default} onChange={(v) => patchZone(zi, { default: v })} />

                        <Divider />

                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            Warehouse routing (in priority order)
                          </Text>
                          <Button variant="plain" onClick={() => addRoute(zi)} disabled={s.warehouses.length === 0}>
                            Add route
                          </Button>
                        </InlineStack>

                        {(z.routes || []).length === 0 && (
                          <Text as="p" tone="subdued" variant="bodySm">
                            No routes. Add warehouses in the order they should be tried.
                          </Text>
                        )}

                        {(z.routes || []).map((r: any, ri: number) => (
                          <InlineStack key={ri} gap="300" blockAlign="end" wrap>
                            <div style={{ minWidth: 60 }}>
                              <Text as="span" tone="subdued" variant="bodySm">
                                #{ri + 1}
                              </Text>
                            </div>
                            <div style={{ minWidth: 180 }}>
                              <Select label="Warehouse" options={whOptions} value={r.warehouse} onChange={(v) => patchRoute(zi, ri, { warehouse: v })} />
                            </div>
                            <div style={{ minWidth: 150 }}>
                              <Select
                                label="Promise"
                                options={[
                                  { label: "Same day", value: "same-day" },
                                  { label: "In N days", value: "days" },
                                ]}
                                value={promiseKind(r.promise)}
                                onChange={(v) => patchRoute(zi, ri, { promise: v === "same-day" ? "same-day" : { type: "days", days: promiseDays(r.promise) || 2 } })}
                              />
                            </div>
                            {promiseKind(r.promise) === "days" && (
                              <div style={{ minWidth: 90 }}>
                                <TextField label="Days" type="number" min={1} value={String(promiseDays(r.promise))} onChange={(v) => patchRoute(zi, ri, { promise: { type: "days", days: Number(v) || 1 } })} autoComplete="off" />
                              </div>
                            )}
                            <Button variant="plain" tone="critical" onClick={() => removeRoute(zi, ri)}>
                              Remove
                            </Button>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              </Card>

              <InlineStack>
                <Button submit name="intent" value="save" variant="primary" loading={busy}>
                  Save delivery rules
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Test a promise
                </Text>
                <Text as="p" tone="subdued">
                  See what a shopper would be told, using the rules on the left.
                </Text>

                <input type="hidden" name="configText" value={configText} />

                <TextField label="Customer emirate" value={emirate} onChange={setEmirate} name="emirate" autoComplete="off" />
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
                  <Box padding="400" background="bg-surface-secondary" borderRadius="300" borderWidth="025" borderColor="border">
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

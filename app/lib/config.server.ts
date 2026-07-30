import prisma from "../db.server";
import type { DeliveryConfig } from "./engine";

// Sensible starter config (Elixir's Ajman/Dubai shape). A merchant edits this
// in the admin; until they save, this is what powers previews and the widget.
export const DEFAULT_CONFIG: DeliveryConfig = {
  timezone: "Asia/Dubai",
  weekend: [5, 6],
  holidays: [],
  cutoffTime: "16:00",
  handlingDays: 0,
  warehouses: [
    { id: "wh1", name: "Warehouse 1", shopifyLocationId: "" },
    { id: "wh2", name: "Warehouse 2", shopifyLocationId: "" },
  ],
  zones: [
    {
      id: "near",
      name: "Near zone",
      match: { emirate: ["Ajman"] },
      routes: [
        { warehouse: "wh1", promise: "same-day" },
        { warehouse: "wh2", promise: { type: "days", days: 2 } },
      ],
    },
    {
      id: "rest",
      name: "Everywhere else",
      default: true,
      match: {},
      routes: [
        { warehouse: "wh2", promise: { type: "days", days: 2 } },
        { warehouse: "wh1", promise: { type: "days", days: 2 } },
      ],
    },
  ],
};

export async function getConfig(shop: string): Promise<DeliveryConfig> {
  const row = await prisma.deliveryConfig.findUnique({ where: { shop } });
  if (!row) return DEFAULT_CONFIG;
  try {
    return JSON.parse(row.config) as DeliveryConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(shop: string, config: DeliveryConfig): Promise<void> {
  const data = JSON.stringify(config);
  await prisma.deliveryConfig.upsert({
    where: { shop },
    create: { shop, config: data },
    update: { config: data },
  });
}

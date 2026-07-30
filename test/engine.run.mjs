// Proof run for the delivery engine — no accounts, no network.
// Uses the example Elixir config and a handful of real-world scenarios.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computePromise } from "../app/lib/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, "../config/example-elixir.json"), "utf8"));

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Aug 2026: 5th = Wed, 7th = Fri (weekend), 9th = Sun (working).
const scenarios = [
  { label: "Ajman shopper · item in Ajman · Wed 10:00 (before cutoff)",
    now: new Date(2026, 7, 5, 10, 0), location: { emirate: "Ajman" }, stock: { ajman: 3, dubai: 9 } },
  { label: "Ajman shopper · item in Ajman · Wed 18:00 (AFTER cutoff)",
    now: new Date(2026, 7, 5, 18, 0), location: { emirate: "Ajman" }, stock: { ajman: 3, dubai: 9 } },
  { label: "Ajman shopper · Ajman EMPTY, only Dubai · Wed 10:00",
    now: new Date(2026, 7, 5, 10, 0), location: { emirate: "Ajman" }, stock: { ajman: 0, dubai: 9 } },
  { label: "Ajman shopper · Ajman EMPTY, only Dubai · Fri 10:00 (weekend)",
    now: new Date(2026, 7, 7, 10, 0), location: { emirate: "Ajman" }, stock: { ajman: 0, dubai: 9 } },
  { label: "Dubai shopper · item in Dubai · Wed 10:00",
    now: new Date(2026, 7, 5, 10, 0), location: { emirate: "Dubai" }, stock: { ajman: 1, dubai: 4 } },
  { label: "Sharjah shopper (Other UAE) · in Dubai · Wed 10:00",
    now: new Date(2026, 7, 5, 10, 0), location: { emirate: "Sharjah" }, stock: { ajman: 0, dubai: 4 } },
  { label: "Ajman shopper · SOLD OUT everywhere",
    now: new Date(2026, 7, 5, 10, 0), location: { emirate: "Ajman" }, stock: { ajman: 0, dubai: 0 } },
  { label: "No zone selected yet",
    now: new Date(2026, 7, 5, 10, 0), location: {}, stock: { ajman: 3, dubai: 9 } },
];

console.log("\nStockPromise — engine proof run\n" + "=".repeat(64));
for (const s of scenarios) {
  const r = computePromise({ config, stockByWarehouse: s.stock, location: s.location, now: s.now });
  const day = WD[s.now.getDay()];
  const ship = r.warehouseName ? `  [${r.warehouseName}]` : "";
  const eta = r.deliverBy ? `  → ${r.deliverBy} (${WD[new Date(r.deliverBy + "T00:00").getDay()]})` : "";
  console.log(`\n• ${s.label}`);
  console.log(`  ${day}  ⇒  ${String(r.status).toUpperCase().padEnd(11)} "${r.message}"${ship}${eta}`);
}
console.log("\n" + "=".repeat(64));

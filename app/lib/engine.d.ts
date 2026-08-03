// Type declarations for the plain-JS delivery engine (engine.js).

export type Promise_ =
  | "same-day"
  | { type: "days"; days: number }
  | string;

export interface Route {
  warehouse: string;
  promise: Promise_;
}

export interface Zone {
  id: string;
  name: string;
  default?: boolean;
  match?: { emirate?: string[]; province?: string[]; city?: string[] };
  routes?: Route[];
}

export interface Warehouse {
  id: string;
  name: string;
  shopifyLocationId?: string;
  odooWarehouseId?: number; // Odoo stock.warehouse id, for reading Odoo stock
}

export interface DeliveryConfig {
  timezone?: string;
  weekend?: number[];        // JS getDay(): 0=Sun … 5=Fri, 6=Sat
  holidays?: string[];       // "YYYY-MM-DD"
  cutoffTime?: string;       // "16:00"
  handlingDays?: number;
  warehouses?: Warehouse[];
  zones?: Zone[];
}

export type PromiseStatus =
  | "same_day"
  | "next_day"
  | "dated"
  | "sold_out"
  | "unknown_zone";

export interface PromiseResult {
  available: boolean | null;
  status: PromiseStatus;
  zone?: string;
  warehouseId?: string;
  warehouseName?: string;
  deliverBy?: string;        // "YYYY-MM-DD"
  message: string;
}

export interface Location {
  emirate?: string;
  province?: string;
  city?: string;
  country?: string;
}

export function computePromise(args: {
  config: DeliveryConfig;
  stockByWarehouse?: Record<string, number>;
  location?: Location;
  now: Date | string | number;
}): PromiseResult;

export function resolveZone(config: DeliveryConfig, location: Location): Zone | null;

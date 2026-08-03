import prisma from "../db.server";
import { encrypt, decrypt } from "./crypto.server";

export interface IntegrationView {
  odooUrl: string;
  odooDb: string;
  odooLogin: string;
  hasKey: boolean;
  matchBy: "barcode" | "sku";
  pushOrders: boolean;
}

// Safe view for the admin UI — never returns the decrypted key.
export async function getIntegration(shop: string): Promise<IntegrationView> {
  const row = await prisma.integration.findUnique({ where: { shop } });
  return {
    odooUrl: row?.odooUrl ?? "",
    odooDb: row?.odooDb ?? "",
    odooLogin: row?.odooLogin ?? "",
    hasKey: !!row?.odooKeyEnc,
    matchBy: row?.matchBy === "sku" ? "sku" : "barcode",
    pushOrders: row?.pushOrders ?? true,
  };
}

// Server-only: full credentials for making Odoo calls, or null if not configured.
export async function getOdooCreds(
  shop: string,
): Promise<{ url: string; db: string; login: string; apiKey: string } | null> {
  const row = await prisma.integration.findUnique({ where: { shop } });
  if (!row?.odooUrl || !row?.odooDb || !row?.odooLogin || !row?.odooKeyEnc) return null;
  try {
    return { url: row.odooUrl, db: row.odooDb, login: row.odooLogin, apiKey: decrypt(row.odooKeyEnc) };
  } catch {
    return null;
  }
}

// Server-only: the decrypted key, for making Odoo calls.
export async function getOdooApiKey(shop: string): Promise<string | null> {
  const row = await prisma.integration.findUnique({ where: { shop } });
  if (!row?.odooKeyEnc) return null;
  try {
    return decrypt(row.odooKeyEnc);
  } catch {
    return null;
  }
}

export async function saveIntegration(
  shop: string,
  data: {
    odooUrl: string;
    odooDb: string;
    odooLogin: string;
    odooKey?: string;
    matchBy?: "barcode" | "sku";
    pushOrders?: boolean;
  },
): Promise<void> {
  const base: {
    odooUrl: string;
    odooDb: string;
    odooLogin: string;
    odooKeyEnc?: string;
    matchBy?: string;
    pushOrders?: boolean;
  } = { odooUrl: data.odooUrl, odooDb: data.odooDb, odooLogin: data.odooLogin };

  if (data.matchBy) base.matchBy = data.matchBy;
  if (typeof data.pushOrders === "boolean") base.pushOrders = data.pushOrders;

  // Only overwrite the stored key when a new one is actually entered.
  if (data.odooKey && data.odooKey.trim()) {
    base.odooKeyEnc = encrypt(data.odooKey.trim());
  }

  await prisma.integration.upsert({
    where: { shop },
    create: { shop, ...base },
    update: base,
  });
}

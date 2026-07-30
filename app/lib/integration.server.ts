import prisma from "../db.server";
import { encrypt, decrypt } from "./crypto.server";

export interface IntegrationView {
  odooUrl: string;
  odooDb: string;
  odooLogin: string;
  hasKey: boolean;
}

// Safe view for the admin UI — never returns the decrypted key.
export async function getIntegration(shop: string): Promise<IntegrationView> {
  const row = await prisma.integration.findUnique({ where: { shop } });
  return {
    odooUrl: row?.odooUrl ?? "",
    odooDb: row?.odooDb ?? "",
    odooLogin: row?.odooLogin ?? "",
    hasKey: !!row?.odooKeyEnc,
  };
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
  data: { odooUrl: string; odooDb: string; odooLogin: string; odooKey?: string },
): Promise<void> {
  const base: {
    odooUrl: string;
    odooDb: string;
    odooLogin: string;
    odooKeyEnc?: string;
  } = { odooUrl: data.odooUrl, odooDb: data.odooDb, odooLogin: data.odooLogin };

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

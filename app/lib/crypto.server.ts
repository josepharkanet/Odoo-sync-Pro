import crypto from "node:crypto";

// At-rest encryption for merchant secrets (e.g. Odoo API keys).
// Key is derived from the app secret so no extra env var is required for MVP.
// For production hardening, switch to a dedicated SP_ENCRYPTION_KEY.
const KEY = crypto
  .createHash("sha256")
  .update(process.env.SHOPIFY_API_SECRET || "stockpromise-dev-key")
  .digest();

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

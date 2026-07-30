export interface OdooCreds {
  url: string;
  db: string;
  login: string;
  apiKey: string;
}

// Verify Odoo credentials via JSON-RPC `common.authenticate`.
// Returns the user id on success — proves URL, database, login and API key work.
export async function testOdoo(c: OdooCreds): Promise<{ ok: boolean; uid?: number; error?: string }> {
  try {
    const endpoint = c.url.replace(/\/+$/, "") + "/jsonrpc";
    const body = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "common",
        method: "authenticate",
        args: [c.db, c.login, c.apiKey, {}],
      },
    };
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j: any = await r.json();
    if (j?.error) {
      return { ok: false, error: j.error?.data?.message || j.error?.message || "Odoo returned an error." };
    }
    if (typeof j?.result === "number" && j.result > 0) {
      return { ok: true, uid: j.result };
    }
    return { ok: false, error: "Authentication failed — check database, login and API key." };
  } catch (e) {
    return { ok: false, error: "Could not reach Odoo: " + (e as Error).message };
  }
}

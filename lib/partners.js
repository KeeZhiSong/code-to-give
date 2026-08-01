// Logistics partners — the transport/warehouse/venue contacts an event
// depends on. A minimal name + confirmed flag: PTS is coordinating a
// handful of named contacts per event, not running a partner directory.
// Feeds the Event Readiness Score alongside headcount and task completion.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function partnersConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function db() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return client;
}

function unwrap(result, what) {
  if (result.error) throw new Error(`Supabase ${what} failed: ${result.error.message}`);
  return result.data;
}

export class PartnerError extends Error {
  constructor(message) {
    super(message);
    this.name = "PartnerError";
  }
}

const trim = (v) => (typeof v === "string" ? v.trim() : v);

export async function listPartners(eventId) {
  if (!partnersConfigured()) throw new PartnerError("Logistics partners need Supabase.");
  const rows = unwrap(
    await db()
      .from("logistics_partners")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
    "list partners"
  );
  return rows || [];
}

export async function createPartner(eventId, input) {
  if (!partnersConfigured()) throw new PartnerError("Logistics partners need Supabase.");
  const name = trim(input.name);
  if (!name) throw new PartnerError("Partner name is required.");

  const row = { event_id: eventId, name, confirmed: Boolean(input.confirmed) };
  return unwrap(
    await db().from("logistics_partners").insert(row).select().single(),
    "create partner"
  );
}

export async function updatePartner(id, input) {
  if (!partnersConfigured()) throw new PartnerError("Logistics partners need Supabase.");
  const data = { updated_at: new Date().toISOString() };

  if ("name" in input) {
    const name = trim(input.name);
    if (!name) throw new PartnerError("Partner name is required.");
    data.name = name;
  }
  if ("confirmed" in input) data.confirmed = Boolean(input.confirmed);

  return unwrap(
    await db().from("logistics_partners").update(data).eq("id", id).select().single(),
    "update partner"
  );
}

export async function deletePartner(id) {
  if (!partnersConfigured()) throw new PartnerError("Logistics partners need Supabase.");
  unwrap(await db().from("logistics_partners").delete().eq("id", id), "delete partner");
}

// Volunteer shift coverage — one role, one day, one event, with a named
// primary and an ordered standby queue behind them.
//
// Server-side only, like every other table in this app: reads and writes go
// through the service_role key here, never from the browser. The first
// version of the dashboard held an anon-key Supabase client in the page and
// wrote shift assignments straight from the client, which either sees nothing
// (RLS on) or lets anyone with the URL reassign shifts (RLS off). Neither is
// a thing to deploy.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function shiftsConfigured() {
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
  if (result.error) {
    throw new Error(`Supabase ${what} failed: ${result.error.message}`);
  }
  return result.data;
}

/** `primary` is a reserved-ish word in the UI layer, so the column is
 *  primary_volunteer and the shape the page wants is built here. */
function toShift(row) {
  return {
    id: row.id,
    date: row.date,
    event: row.event || "",
    time: row.time || "",
    role: row.role || "",
    primary: row.primary_volunteer || null,
    standby: row.standby || [],
    status: row.status || "ok",
  };
}

/** Every shift, soonest first. */
export async function listShifts() {
  if (!shiftsConfigured()) return [];
  const rows = unwrap(
    await db().from("shifts").select("*").order("date", { ascending: true }),
    "list shifts"
  );
  return (rows || []).map(toShift);
}

/**
 * The primary volunteer has dropped out — hand the shift to the first
 * standby, or mark it unfilled if nobody is queued.
 *
 * The promotion is computed HERE rather than sent up from the browser: the
 * page would otherwise be telling the server who the next volunteer is, which
 * makes "who covers this shift" a client-side decision that anyone could
 * forge. Returns the updated shift, so the page renders what actually landed
 * rather than what it predicted.
 */
export async function coverShift(id) {
  const row = unwrap(
    await db().from("shifts").select("*").eq("id", id).maybeSingle(),
    "read shift"
  );
  if (!row) throw new Error("Shift not found.");

  const queue = row.standby || [];
  const [next, ...remaining] = queue;

  const update = next
    ? { primary_volunteer: next, standby: remaining, status: "covered" }
    : { primary_volunteer: null, status: "open" };

  const updated = unwrap(
    await db().from("shifts").update(update).eq("id", id).select().single(),
    "update shift"
  );

  return {
    shift: toShift(updated),
    // What happened, for the page's activity log — decided server-side so the
    // log can't say "covered" while the database says "open".
    cancelled: row.primary_volunteer || null,
    promoted: next || null,
    remaining: next ? remaining : [],
  };
}

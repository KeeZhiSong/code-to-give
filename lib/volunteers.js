// Volunteers — read from Supabase, topped up from the Google Form sheet.
//
// Division of labour:
//   Google Form → Sheet   the INTAKE. Zero build, works on any phone.
//   volunteers table      the SOURCE OF TRUTH the app reads and writes.
//
// Why not read the sheet directly on every request (which is what we did
// before): a published CSV is edge-cached by Google, so a fresh signup can take
// several minutes to appear — it looks exactly like a bug. The table is also
// the only place that can hold what the app learns later: notes, tags,
// attendance history.
//
// Sync is deliberately additive. It never deletes: someone removed from the
// sheet keeps their registration history, and app-managed columns (`notes`)
// are never overwritten by a sync.

import { createClient } from "@supabase/supabase-js";
import { getVolunteers as readSheet } from "./sheets.js";

let client = null;

export function volunteersConfigured() {
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

function toVolunteer(row) {
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone,
    type: row.type || "",
    pillars: row.pillars || [],
    roles: row.roles || [],
    notes: row.notes || "",
  };
}

/**
 * Which events has each phone actually turned up to?
 *
 * Derived from registrations rather than stored on the volunteer: the
 * registration already knows who, which event, and whether they showed. A
 * duplicate list on `volunteers` would drift the moment someone cancels or an
 * event is deleted.
 *
 * Returns a Map of phone -> [{ event, at }], most recent first.
 */
async function attendanceByPhone() {
  const rows = unwrap(
    await db()
      .from("registrations")
      .select("phone, created_at, events(name, starts_at)")
      .eq("status", "attended"),
    "read attendance"
  );

  const map = new Map();
  for (const r of rows || []) {
    const list = map.get(r.phone) || [];
    list.push({
      event: r.events?.name || "(deleted event)",
      at: r.events?.starts_at || r.created_at,
    });
    map.set(r.phone, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  return map;
}

/** Everyone in the table, newest signup last, with attendance history. */
export async function listVolunteers() {
  const [rows, attendance] = await Promise.all([
    (async () =>
      unwrap(
        await db()
          .from("volunteers")
          .select("*")
          .order("first_seen_at", { ascending: true }),
        "list volunteers"
      ))(),
    attendanceByPhone(),
  ]);

  return (rows || []).map((row) => ({
    ...toVolunteer(row),
    attended: attendance.get(row.phone) || [],
  }));
}

export async function countVolunteers() {
  const { count, error } = await db()
    .from("volunteers")
    .select("phone", { count: "exact", head: true });
  if (error) throw new Error(`Supabase count volunteers failed: ${error.message}`);
  return count || 0;
}

/** Two profiles differ if anything the form controls has changed. */
function differs(existing, incoming) {
  const sameList = (a = [], b = []) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  return (
    (existing.name || "") !== (incoming.name || "") ||
    (existing.type || "") !== (incoming.type || "") ||
    !sameList(existing.pillars, incoming.pillars) ||
    !sameList(existing.roles, incoming.roles)
  );
}

/**
 * Pull the sheet across into the table.
 * Returns { added, updated, unchanged, total } so the UI can say what happened.
 */
export async function syncFromSheet() {
  const fromSheet = await readSheet();

  // A sheet row with no usable phone can't be messaged or keyed on — skip it
  // rather than writing a row nothing can ever reach.
  const usable = fromSheet.filter((v) => v.phone && v.phone.length >= 8);

  const existing = unwrap(
    await db().from("volunteers").select("phone,name,type,pillars,roles"),
    "read volunteers for sync"
  );
  const byPhone = new Map((existing || []).map((r) => [r.phone, r]));

  const now = new Date().toISOString();
  const toInsert = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const v of usable) {
    const incoming = {
      phone: v.phone,
      name: v.name || null,
      type: v.type || null,
      pillars: v.pillars || [],
      roles: v.roles || [],
    };
    const prior = byPhone.get(v.phone);

    if (!prior) {
      toInsert.push({ ...incoming, source: "form", updated_at: now });
    } else if (differs(prior, incoming)) {
      // Note: `notes` is absent here on purpose — a sync must never clobber it.
      toUpdate.push({ ...incoming, updated_at: now });
    } else {
      unchanged += 1;
    }
  }

  if (toInsert.length > 0) {
    unwrap(await db().from("volunteers").insert(toInsert), "insert volunteers");
  }
  for (const row of toUpdate) {
    unwrap(
      await db().from("volunteers").update(row).eq("phone", row.phone),
      "update volunteer"
    );
  }

  return {
    added: toInsert.length,
    updated: toUpdate.length,
    unchanged,
    total: usable.length,
    skipped: fromSheet.length - usable.length,
  };
}

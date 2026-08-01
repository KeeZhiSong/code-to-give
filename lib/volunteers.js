// Volunteers — read from Supabase, topped up from the Google Form sheet.
//
// Division of labour:
//   Google Form → Sheet   the INTAKE. Zero build, works on any phone.
//   volunteers table      the SOURCE OF TRUTH the app reads and writes.
//
// Why not read the sheet directly on every request (which is what we did
// before): a published CSV is edge-cached by Google, so a fresh signup can take
// several minutes to appear — it looks exactly like a bug. The table is also
// the only place that can hold what the app learns later: notes, tags, history.
//
// Sync is deliberately additive. It never deletes: someone removed from the
// sheet keeps their registrations, and app-managed columns (`notes`) are never
// overwritten by a sync.

import { createClient } from "@supabase/supabase-js";
import { getVolunteers as readSheet } from "./sheets.js";
import { syncBeneficiaries } from "./beneficiaries.js";

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
    // Legacy loyalty signal — predates volunteer_event_log (migration 005)
    // and nothing writes to it any more; kept read-only for continuity.
    eventsAttended: row.events_attended || [],
    // Volunteer Loyalty Programme (migration 005). Cached on the row, kept
    // in sync by lib/loyalty.js on every "mark attended".
    loyaltyPoints: row.loyalty_points || 0,
    loyaltyTier: row.loyalty_tier || "",
    notes: row.notes || "",
  };
}

/** Everyone in the table, newest signup last. */
export async function listVolunteers() {
  const rows = unwrap(
    await db()
      .from("volunteers")
      .select("*")
      .order("first_seen_at", { ascending: true }),
    "list volunteers"
  );
  return (rows || []).map(toVolunteer);
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
/**
 * Which table does a sheet row belong in?
 *
 * A blank answer means the row predates the "I am a ..." question. Those default
 * to volunteer — the behaviour before beneficiaries existed — because silently
 * moving an existing person to another table would drop them out of the
 * recipient list they're already on.
 */
export function isBeneficiary(person) {
  return /^benef/i.test(String(person.type || "").trim());
}

export async function syncFromSheet() {
  // The volunteer form. Beneficiaries get their own form, and therefore their
  // own sheet — set BENEFICIARY_SHEET_CSV_URL when that exists.
  const fromSheet = await readSheet();
  const beneficiaryUrl = process.env.BENEFICIARY_SHEET_CSV_URL;
  const fromBeneficiarySheet = beneficiaryUrl
    ? await readSheet(beneficiaryUrl)
    : [];

  // A row with no usable phone can't be messaged or keyed on — skip it rather
  // than writing a row nothing can ever reach.
  const hasPhone = (p) => p.phone && p.phone.length >= 8;
  const usableAll = fromSheet.filter(hasPhone);

  const usable = usableAll.filter((v) => !isBeneficiary(v));
  // Anyone on the volunteer sheet who still answers "Beneficiary" is routed
  // across — a safety net for legacy rows, not the main path.
  const beneficiaries = [
    ...usableAll.filter(isBeneficiary),
    ...fromBeneficiarySheet.filter(hasPhone),
  ];

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
      // Type comes from WHICH FORM they filled, not from a column: the
      // volunteer form has no "I am a" question any more, so a blank value
      // must not overwrite an existing "Volunteer" with null.
      type: v.type || "Volunteer",
      pillars: v.pillars || [],
      roles: v.roles || [],
    };
    const prior = byPhone.get(v.phone);

    if (!prior) {
      toInsert.push({ ...incoming, source: "form", updated_at: now });
    } else if (differs(prior, incoming)) {
      // `notes` and `events_attended` are absent here on purpose — they're
      // app-managed, and a sync must never clobber them.
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

  const b = await syncBeneficiaries(beneficiaries);

  return {
    added: toInsert.length + b.added,
    updated: toUpdate.length + b.updated,
    unchanged: unchanged + b.unchanged,
    total: usableAll.length + fromBeneficiarySheet.length,
    skipped:
      fromSheet.length -
      usableAll.length +
      (fromBeneficiarySheet.length - fromBeneficiarySheet.filter(hasPhone).length),
    volunteers: usable.length,
    beneficiaries: beneficiaries.length,
  };
}

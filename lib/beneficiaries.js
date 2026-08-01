// Beneficiaries (migrant workers) — the other half of the Google Form intake.
//
// Same shape as lib/volunteers.js, different columns: courses and progress
// rather than pillars and roles. Phone is the routing key in both tables, and
// registrations reference it as a plain string, so a beneficiary can RSVP to an
// event exactly like a volunteer.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function beneficiariesConfigured() {
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

function toBeneficiary(row) {
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone,
    type: "Beneficiary",
    languages: row.languages || [],
    courses: row.courses || [],
    area: row.area || "",
    courseProgress: row.course_progress || {},
    // VIP Pass (migration 007). Cached on the row, kept in sync by
    // lib/loyalty.js on every "mark attended" — vip_status flips once
    // attendance count crosses VIP_THRESHOLD_ATTENDANCES.
    loyaltyPoints: row.loyalty_points || 0,
    vipStatus: Boolean(row.vip_status),
    notes: row.notes || "",
  };
}

export async function listBeneficiaries() {
  const rows = unwrap(
    await db()
      .from("beneficiaries")
      .select("*")
      .order("first_seen_at", { ascending: true }),
    "list beneficiaries"
  );
  const list = (rows || []).map(toBeneficiary);
  if (list.length === 0) return list;

  // Which events each has attended, from the activity log (migration 007).
  // Volunteers carry this as an array on their row; beneficiaries keep it in
  // the log, so derive the same shape here — otherwise the roster can't tell
  // whether a beneficiary has already been marked, and the VIP Pass would
  // never be reachable from the console.
  let attended = new Map();
  try {
    const logs = unwrap(
      await db()
        .from("beneficiary_activity_log")
        .select("beneficiary_id, events(name)"),
      "read beneficiary activity log"
    );
    for (const row of logs || []) {
      const names = attended.get(row.beneficiary_id) || [];
      if (row.events?.name) names.push(row.events.name);
      attended.set(row.beneficiary_id, names);
    }
  } catch {
    // Migration 007 not run yet — leave the lists empty rather than failing
    // the whole recipients pane.
  }

  return list.map((b) => ({ ...b, eventsAttended: attended.get(b.id) || [] }));
}

export async function countBeneficiaries() {
  const { count, error } = await db()
    .from("beneficiaries")
    .select("phone", { count: "exact", head: true });
  if (error) {
    throw new Error(`Supabase count beneficiaries failed: ${error.message}`);
  }
  return count || 0;
}

/**
 * Upsert the beneficiary side of a sheet sync.
 *
 * Only touches columns the form owns. `courses`, `area`, `course_progress` and
 * `notes` are app-managed for now — the form doesn't collect them yet, and a
 * sync must never wipe what an organiser has filled in by hand.
 */
export async function syncBeneficiaries(fromSheet) {
  const existing = unwrap(
    await db().from("beneficiaries").select("phone,name"),
    "read beneficiaries for sync"
  );
  const byPhone = new Map((existing || []).map((r) => [r.phone, r]));

  const now = new Date().toISOString();
  const toInsert = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const p of fromSheet) {
    const prior = byPhone.get(p.phone);
    const name = p.name || null;

    if (!prior) {
      toInsert.push({ phone: p.phone, name, source: "form", updated_at: now });
    } else if ((prior.name || "") !== (name || "")) {
      toUpdate.push({ phone: p.phone, name, updated_at: now });
    } else {
      unchanged += 1;
    }
  }

  if (toInsert.length > 0) {
    unwrap(
      await db().from("beneficiaries").insert(toInsert),
      "insert beneficiaries"
    );
  }
  for (const row of toUpdate) {
    unwrap(
      await db().from("beneficiaries").update(row).eq("phone", row.phone),
      "update beneficiary"
    );
  }

  return { added: toInsert.length, updated: toUpdate.length, unchanged };
}

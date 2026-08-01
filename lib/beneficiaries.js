// Beneficiaries (migrant workers) — the other half of the Google Form intake.
//
// Same shape as lib/volunteers.js, different columns: courses and progress
// rather than pillars and roles. Phone is the routing key in both tables, and
// registrations reference it as a plain string, so a beneficiary can RSVP to an
// event exactly like a volunteer.

import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "./sheets.js";

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

export class BeneficiaryError extends Error {
  constructor(message) {
    super(message);
    this.name = "BeneficiaryError";
  }
}

/** Split "Tamil, Bengali" or an array into a clean list. */
function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Shape an incoming payload. `partial` keeps only what the caller sent, so a
 * PATCH carrying just {area} can't blank the languages.
 */
function clean(input, { partial = false } = {}) {
  const out = {};
  const set = (key, value) => {
    if (partial && !(key in input)) return;
    out[key] = value;
  };
  // Phone goes through the same normaliser the sheet import uses, so a number
  // typed by hand routes to WhatsApp identically to one that arrived by form.
  if (!partial || "phone" in input) out.phone = normalizePhone(input.phone);
  set("name", String(input.name || "").trim() || null);
  set("area", String(input.area || "").trim() || null);
  set("notes", String(input.notes || "").trim() || null);
  set("languages", toList(input.languages));
  set("courses", toList(input.courses));
  return out;
}

function validate(data, { partial = false } = {}) {
  if (!partial || "phone" in data) {
    // 8 digits is the shortest number that could reach anyone; below that it's
    // a typo, and a beneficiary nobody can message is worse than none.
    if (!data.phone || data.phone.length < 8) {
      throw new BeneficiaryError("A valid phone number is required.");
    }
  }
  if (!partial || "name" in data) {
    if (!data.name) throw new BeneficiaryError("Name is required.");
  }
}

export async function createBeneficiary(input) {
  if (!beneficiariesConfigured()) {
    throw new BeneficiaryError("Beneficiaries need Supabase.");
  }
  const data = clean(input);
  validate(data);

  const result = await db()
    .from("beneficiaries")
    .insert({ ...data, source: "manual" })
    .select()
    .single();
  // phone is unique — the routing key. A duplicate would split one person's
  // history across two rows.
  if (result.error?.code === "23505") {
    throw new BeneficiaryError(
      "Someone with that phone number is already registered."
    );
  }
  return toBeneficiary(unwrap(result, "create beneficiary"));
}

export async function updateBeneficiary(id, input) {
  if (!beneficiariesConfigured()) {
    throw new BeneficiaryError("Beneficiaries need Supabase.");
  }
  const data = clean(input, { partial: true });
  validate(data, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new BeneficiaryError("Nothing to update.");
  }

  const result = await db()
    .from("beneficiaries")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (result.error?.code === "23505") {
    throw new BeneficiaryError(
      "Someone with that phone number is already registered."
    );
  }
  return toBeneficiary(unwrap(result, "update beneficiary"));
}

export async function deleteBeneficiary(id) {
  if (!beneficiariesConfigured()) {
    throw new BeneficiaryError("Beneficiaries need Supabase.");
  }
  // beneficiary_activity_log cascades — removing someone removes their
  // attendance history with them.
  unwrap(
    await db().from("beneficiaries").delete().eq("id", id),
    "delete beneficiary"
  );
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

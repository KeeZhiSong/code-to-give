// Supabase-backed implementation of the response store.
//
// Same function signatures as the JSON-file store in store.js — the rest of the
// app can't tell which one it's talking to. store.js picks between them.
//
// Why this exists: Vercel's filesystem is ephemeral and read-only outside the
// temp dir, so the JSON store silently loses every RSVP once deployed.
//
// Keys: uses SUPABASE_SERVICE_ROLE_KEY, which BYPASSES row-level security.
// It must never reach a client component. Everything here runs in route
// handlers, which are server-only.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function supabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function db() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      // No session to persist — this is a server-side service client.
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

// Supabase returns { data, error } rather than throwing. Swallowing `error`
// is how you get a roster that's silently always empty, so surface it loudly.
function unwrap(result, what) {
  if (result.error) {
    throw new Error(`Supabase ${what} failed: ${result.error.message}`);
  }
  return result.data;
}

// ─── Campaign ⇄ event ────────────────────────────────────────────────────────
// The app talks in campaign names; the database keys on event ids. Resolve here
// and create on first sight, so a new CAMPAIGN value doesn't need a manual row.
const eventIdCache = new Map();

async function eventIdFor(campaign) {
  if (eventIdCache.has(campaign)) return eventIdCache.get(campaign);

  const existing = unwrap(
    await db().from("events").select("id").eq("name", campaign).maybeSingle(),
    "event lookup",
  );

  let id = existing?.id;
  if (!id) {
    const created = unwrap(
      await db()
        .from("events")
        .insert({ name: campaign, status: "open" })
        .select("id")
        .single(),
      "event create",
    );
    id = created.id;
  }

  eventIdCache.set(campaign, id);
  return id;
}

// A caller that already knows the exact event id (e.g. resolved via
// poll_prompts.stanza_id at send-time) should always win over the name
// lookup above — the same event's name can round-trip through GreenAPI with
// a subtly different string (whitespace, casing, a stale poll question), and
// the name lookup would then silently CREATE a duplicate `events` row,
// splitting the registration off from the event the poll was actually sent
// for. Passing eventId through skips that lookup entirely.
async function resolveEventId(campaign, eventId) {
  return eventId || eventIdFor(campaign);
}

// Shape a registrations row back into what the UI already expects.
function toEntry(row, campaign) {
  return {
    phone: row.phone,
    name: row.name || row.phone,
    answer: row.answer,
    campaign,
    raw: row.raw || "",
    at: row.created_at,
  };
}

// ─── Responses ───────────────────────────────────────────────────────────────

export async function recordResponse({
  phone,
  name,
  answer,
  campaign,
  raw,
  eventId,
}) {
  const resolvedEventId = await resolveEventId(campaign, eventId);
  const row = {
    event_id: resolvedEventId,
    phone,
    name: name || phone,
    answer,
    raw: raw || "",
    created_at: new Date().toISOString(),
  };

  // One response per (event, phone) — a changed vote overwrites the old one.
  const saved = unwrap(
    await db()
      .from("registrations")
      .upsert(row, { onConflict: "event_id,phone" })
      .select()
      .single(),
    "record response",
  );
  return toEntry(saved, campaign);
}

export async function clearResponse({ phone, campaign, eventId }) {
  const resolvedEventId = await resolveEventId(campaign, eventId);
  unwrap(
    await db()
      .from("registrations")
      .delete()
      .eq("event_id", resolvedEventId)
      .eq("phone", phone),
    "clear response",
  );
}

export async function getResponses(campaign, eventId) {
  const resolvedEventId = await resolveEventId(campaign, eventId);
  const rows = unwrap(
    await db()
      .from("registrations")
      .select()
      .eq("event_id", resolvedEventId)
      .order("created_at", { ascending: true }),
    "read responses",
  );
  return (rows || []).map((r) => toEntry(r, campaign));
}

export async function getRoster(campaign) {
  const rows = await getResponses(campaign);
  return {
    going: rows.filter((r) => r.answer === "yes"),
    notGoing: rows.filter((r) => r.answer === "no"),
    total: rows.length,
  };
}

// ─── Opt-outs ────────────────────────────────────────────────────────────────

export async function getOptOuts() {
  const rows = unwrap(
    await db().from("opt_outs").select("phone"),
    "read opt-outs",
  );
  return (rows || []).map((r) => r.phone);
}

export async function addOptOut(phone) {
  unwrap(
    await db()
      .from("opt_outs")
      // Already-opted-out is success, not an error.
      .upsert({ phone }, { onConflict: "phone", ignoreDuplicates: true }),
    "add opt-out",
  );
}

/**
 * Let someone back onto the list.
 *
 * Withdrawing consent has to be honoured; it doesn't have to be permanent.
 * Without this a mistyped STOP, a shared phone, or a change of heart next
 * month locked a volunteer out of the programme for good.
 */
export async function removeOptOut(phone) {
  unwrap(
    // Not being on the list is success, not an error.
    await db().from("opt_outs").delete().eq("phone", phone),
    "remove opt-out",
  );
}

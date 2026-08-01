// Events — the thing every RSVP, poll and roster hangs off.
//
// Backed by the Supabase `events` table. When Supabase isn't configured (local
// dev without credentials) this falls back to a single read-only event built
// from lib/config.js, so the app still runs — you just can't create more.
//
// The event NAME doubles as the campaign key: lib/store.js resolves a campaign
// name to an event id, so the roster and these records line up without the
// rest of the app having to pass ids around.

import { createClient } from "@supabase/supabase-js";
import { EVENT } from "./config.js";

let client = null;

export function eventsConfigured() {
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

// The stand-in used when there's no database — mirrors what the app did before
// events existed, so nothing breaks without credentials.
function fallbackEvent() {
  return {
    id: "config",
    name: EVENT.campaign,
    question: EVENT.question,
    pillar: null,
    track: null,
    starts_at: null,
    ends_at: null,
    venue: null,
    capacity: null,
    points_value: 1,
    description: null,
    what_to_bring: null,
    dress_code: null,
    meeting_point: null,
    confirm_yes: null,
    confirm_no: null,
    contact_name: null,
    contact_phone: null,
    status: "open",
    readOnly: true,
  };
}

/** Every event, soonest first. Events with no date sort last. */
export async function listEvents() {
  if (!eventsConfigured()) return [fallbackEvent()];

  const rows = unwrap(
    await db()
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true, nullsFirst: false }),
    "list events"
  );
  return rows || [];
}

export async function getEvent(id) {
  if (!eventsConfigured()) return fallbackEvent();
  const row = unwrap(
    await db().from("events").select("*").eq("id", id).maybeSingle(),
    "get event"
  );
  return row || null;
}

/** Look up by name — the bridge between campaign strings and event records. */
export async function getEventByName(name) {
  if (!eventsConfigured()) return fallbackEvent();
  const row = unwrap(
    await db().from("events").select("*").eq("name", name).maybeSingle(),
    "get event by name"
  );
  return row || null;
}

const trim = (v) => (typeof v === "string" ? v.trim() : v);

// Map each column to how its incoming value is normalised.
const FIELDS = {
  name: (v) => trim(v),
  pillar: (v) => trim(v) || null,
  track: (v) => trim(v) || null,
  // datetime-local gives "2026-08-09T09:00" with no zone; let Postgres take it
  // as-is rather than guessing UTC and shifting the time by 8 hours.
  starts_at: (v) => v || null,
  venue: (v) => trim(v) || null,
  capacity: (v) => (v === "" || v == null ? null : Number(v)),
  question: (v) => trim(v) || null,
  status: (v) => trim(v) || "open",
  // Loyalty Programme / VIP Pass (migration 007) — how many points this event
  // is worth. Blank falls back to the column default (1) rather than null,
  // since a null here would break the points arithmetic in lib/loyalty.js.
  points_value: (v) => (v === "" || v == null ? 1 : Number(v)),

  // Event details (migration 008). All optional — a blank field just drops
  // its line from the WhatsApp message; see lib/eventMessage.js.
  description: (v) => trim(v) || null,
  what_to_bring: (v) => trim(v) || null,
  dress_code: (v) => trim(v) || null,
  meeting_point: (v) => trim(v) || null,
  ends_at: (v) => v || null,
  // Editable RSVP replies. Null falls back to the default wording.
  confirm_yes: (v) => trim(v) || null,
  confirm_no: (v) => trim(v) || null,
  // On-the-day contact (migration 009) — who to look for, who to call.
  contact_name: (v) => trim(v) || null,
  contact_phone: (v) => trim(v) || null,
};

/**
 * Normalise an incoming payload.
 *
 * `partial` keeps only the keys the caller actually sent. Without it a PATCH
 * carrying just {name, question} would write null over pillar, venue and
 * starts_at — silently wiping fields nobody asked to change.
 */
function clean(input, { partial = false } = {}) {
  const out = {};
  for (const [key, normalise] of Object.entries(FIELDS)) {
    if (partial && !(key in input)) continue;
    out[key] = normalise(input[key]);
  }
  return out;
}

export class EventError extends Error {
  constructor(message) {
    super(message);
    this.name = "EventError";
  }
}

// Columns added by migration 008. Everything before it is required for the app
// to function; these are additive.
const DETAIL_COLUMNS = [
  "description",
  "what_to_bring",
  "dress_code",
  "meeting_point",
  "ends_at",
  "confirm_yes",
  "confirm_no",
  "contact_name",
  "contact_phone",
];

/**
 * The column PostgREST is complaining about, or null if that isn't the
 * complaint. The message reads: Could not find the 'x' column of 'events'…
 */
function missingColumn(error) {
  if (!error) return null;
  const match = /Could not find the '([^']+)' column/i.exec(error.message || "");
  return match ? match[1] : null;
}

/**
 * Run a write, dropping any column the database doesn't have yet and retrying.
 *
 * Deploys happen on push while migrations are run by hand, so the two are
 * briefly out of step. Without this, creating an event fails outright in that
 * window — details are a nice-to-have, but creating an event is the whole tool.
 *
 * Drops columns ONE AT A TIME, named by the error. An earlier version removed
 * every optional column on the first failure, so a database missing only
 * `contact_name` silently lost the description, dress code and everything else
 * a cloned event had been given.
 */
async function withoutMissingDetails(data, run) {
  let payload = data;
  // Bounded so a genuinely broken payload can't loop; one pass per optional
  // column is the worst legitimate case.
  for (let attempt = 0; attempt <= DETAIL_COLUMNS.length; attempt += 1) {
    const result = await run(payload);
    const column = missingColumn(result.error);
    if (!column || !(column in payload)) return result;
    payload = { ...payload };
    delete payload[column];
  }
  return run(payload);
}

// On a partial update only the supplied fields are checked — an absent key
// means "leave it alone", not "clear it".
function validate(data, { partial = false } = {}) {
  if (!partial || "name" in data) {
    if (!data.name) throw new EventError("Event name is required.");
  }
  if (!partial || "question" in data) {
    if (!data.question) throw new EventError("Poll question is required.");
  }
  if (data.capacity != null && (!Number.isFinite(data.capacity) || data.capacity < 0)) {
    throw new EventError("Capacity must be a positive number.");
  }
  if (
    data.points_value != null &&
    (!Number.isFinite(data.points_value) || data.points_value < 1)
  ) {
    throw new EventError("Points value must be a positive number.");
  }
}

export async function createEvent(input) {
  if (!eventsConfigured()) {
    throw new EventError(
      "Events need Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  const data = clean(input);
  validate(data);

  const result = await withoutMissingDetails(data, (payload) =>
    db().from("events").insert(payload).select().single()
  );
  // events.name is unique — it's the campaign key, so duplicates would split
  // one roster across two rows.
  if (result.error?.code === "23505") {
    throw new EventError(`An event named "${data.name}" already exists.`);
  }
  return unwrap(result, "create event");
}

export async function updateEvent(id, input) {
  if (!eventsConfigured()) throw new EventError("Events need Supabase.");
  const data = clean(input, { partial: true });
  validate(data, { partial: true });
  if (Object.keys(data).length === 0) {
    throw new EventError("Nothing to update.");
  }

  const result = await withoutMissingDetails(data, (payload) =>
    db().from("events").update(payload).eq("id", id).select().single()
  );
  if (result.error?.code === "23505") {
    throw new EventError(`An event named "${data.name}" already exists.`);
  }
  return unwrap(result, "update event");
}

export async function deleteEvent(id) {
  if (!eventsConfigured()) throw new EventError("Events need Supabase.");
  // registrations cascade on delete — removing an event removes its roster.
  unwrap(await db().from("events").delete().eq("id", id), "delete event");
}

// ─── Poll → event routing ────────────────────────────────────────────────────
// Recording the poll's message id when we send lets an incoming vote resolve to
// an event directly, instead of comparing the question text it came back with.

export async function recordPollPrompt({ stanzaId, eventId, intent = "invite" }) {
  if (!eventsConfigured() || !stanzaId) return;
  // Best-effort: a failure here costs us the fast path, not the vote — the
  // webhook still falls back to matching on question text.
  try {
    await db()
      .from("poll_prompts")
      .upsert({ stanza_id: stanzaId, event_id: eventId, intent }, { onConflict: "stanza_id" });
  } catch {
    /* ignore */
  }
}

export async function eventForStanza(stanzaId) {
  if (!eventsConfigured() || !stanzaId) return null;
  try {
    const row = unwrap(
      await db()
        .from("poll_prompts")
        .select("event_id, events(name)")
        .eq("stanza_id", stanzaId)
        .maybeSingle(),
      "poll prompt lookup"
    );
    return row?.events?.name || null;
  } catch {
    return null;
  }
}

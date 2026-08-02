// Live Headcount — confirmed/waitlisted volunteers and confirmed
// beneficiaries for one event, computed fresh on every read.
//
// There's no separate "waitlisted" status in `registrations` (see schema.sql):
// a "yes" is a "yes". The waitlist is FIFO overflow past the event's volunteer
// capacity — first `capacity` confirmed replies are confirmed, the rest wait
// for a drop-out. Beneficiaries aren't capacity-gated: PTS doesn't turn away
// migrant workers who show up for GIFTIK or a course, so their tile just
// reports how many said yes, no target.

import { createClient } from "@supabase/supabase-js";
import { getEvent } from "./events.js";

let client = null;

function db() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

function unwrap(result, what) {
  if (result.error)
    throw new Error(`Supabase ${what} failed: ${result.error.message}`);
  return result.data;
}

/** Everyone who's already responded (yes or no) to this event — re-inviting
 *  someone already confirmed, or who already said they can't make it, isn't
 *  useful. */
export async function getRespondedPhones(eventId) {
  const rows =
    unwrap(
      await db().from("registrations").select("phone").eq("event_id", eventId),
      "responded phones",
    ) || [];
  return new Set(rows.map((r) => r.phone));
}

// Shared by getEventHeadcount and getWaitlistedVolunteers so the FIFO split
// (first `capacity` confirmed, the rest waitlisted) can't drift between them.
async function splitVolunteersByCapacity(eventId, event) {
  const yesRows =
    unwrap(
      await db()
        .from("registrations")
        .select("phone, name, created_at")
        .eq("event_id", eventId)
        .eq("answer", "yes")
        .order("created_at", { ascending: true }),
      "headcount registrations",
    ) || [];

  const phones = [...new Set(yesRows.map((r) => r.phone))];

  let beneficiaryPhones = new Set();

  if (phones.length > 0) {
    const beneficiaryRows = unwrap(
      await db().from("beneficiaries").select("phone").in("phone", phones),
      "headcount beneficiaries",
    );
    beneficiaryPhones = new Set((beneficiaryRows || []).map((r) => r.phone));
  }

  // Anyone who replied "yes" and isn't a known beneficiary is treated as a
  // volunteer — the same assumption the console made before beneficiaries
  // existed as a separate table.
  const volunteerRegs = yesRows.filter((r) => !beneficiaryPhones.has(r.phone));
  const beneficiaryRegs = yesRows.filter((r) => beneficiaryPhones.has(r.phone));

  const capacity = event.capacity ?? null;
  const confirmedVolunteers =
    capacity != null ? volunteerRegs.slice(0, capacity) : volunteerRegs;
  const waitlistedVolunteers =
    capacity != null ? volunteerRegs.slice(capacity) : [];

  return {
    confirmedVolunteers,
    waitlistedVolunteers,
    beneficiaryRegs,
    capacity,
  };
}

export async function getEventHeadcount(eventId) {
  const event = await getEvent(eventId);
  if (!event) return null;

  const {
    confirmedVolunteers,
    waitlistedVolunteers,
    beneficiaryRegs,
    capacity,
  } = await splitVolunteersByCapacity(eventId, event);

  return {
    eventId,
    eventName: event.name,
    volunteers: {
      confirmed: confirmedVolunteers.length,
      waitlisted: waitlistedVolunteers.length,
      target: capacity,
    },
    beneficiaries: {
      confirmed: beneficiaryRegs.length,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Everyone past capacity, oldest-first — who a freed slot promotes next.
 * Returns [] for an event with no capacity set (nobody waits when there's no
 * cap) or no waitlist yet.
 */
export async function getWaitlistedVolunteers(eventId) {
  const event = await getEvent(eventId);
  if (!event || event.capacity == null) return [];

  const { waitlistedVolunteers } = await splitVolunteersByCapacity(
    eventId,
    event,
  );
  return waitlistedVolunteers.map((r) => ({
    phone: r.phone,
    name: r.name || r.phone,
  }));
}

/**
 * Is this person holding a real slot, as opposed to queueing for one?
 *
 * The distinction matters when someone drops out: a confirmed volunteer
 * leaving frees a slot and promotes the next in line, while a WAITLISTED
 * volunteer leaving frees nothing — everyone behind them just shuffles up one
 * place, still waiting.
 *
 * True when no capacity is set, because an uncapped event confirms everyone.
 */
export async function isConfirmedVolunteer(eventId, phone) {
  const event = await getEvent(eventId);
  if (!event) return false;
  if (event.capacity == null) return true;

  const { confirmedVolunteers } = await splitVolunteersByCapacity(
    eventId,
    event,
  );
  return confirmedVolunteers.some((r) => r.phone === phone);
}

// Volunteer Loyalty Programme + Beneficiary VIP Pass.
//
// Both features hang off the existing WhatsApp RSVP reply, not a separate
// manual step: replying "YES" to an event poll (handled in
// lib/handleWebhook.js, built concurrently by the rest of the team) IS the
// attendance signal. That write appends to a per-person log — the audit
// trail Excel couldn't give them (WHEN, at WHICH event, worth how many
// points) — then refreshes a cached total, so a door-side VIP check or a
// dashboard badge is a single-row read, not a COUNT() join every time. See
// supabase/005_loyalty_vip.sql for the schema and the reasoning behind each
// choice.
//
// A changed mind must undo the credit, not just stop adding to it: replying
// "NO" after "YES", or retracting a poll vote entirely, calls unmarkAttended
// so a flip-flop can't leave phantom points or a VIP flag nobody earned.
//
// Volunteers and beneficiaries get separate log tables and separate
// behaviour here, mirroring why migration 004 made them separate tables in
// the first place:
//   - Volunteers: points accumulate every attendance. No tier ladder is
//     defined yet, so nothing auto-sends yet — see the note above
//     VIP_THRESHOLD_ATTENDANCES in lib/config.js.
//   - Beneficiaries: points accumulate too, but the only message that fires
//     automatically is the VIP Pass grant, and only on the ONE call that
//     crosses the threshold — never again on every visit after, so a
//     frequent beneficiary isn't re-congratulated every time they show up.

import { createClient } from "@supabase/supabase-js";
import { getEventByName } from "./events.js";
import { sendImage, toChatId } from "./greenapi.js";
import { renderVipPassImage, renderVolunteerMilestoneImage } from "./poster.jsx";
import { VIP_THRESHOLD_ATTENDANCES } from "./config.js";

let client = null;

export function loyaltyConfigured() {
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

// A phone belongs to exactly one of these tables — never both, since the
// Google Form intake splits on "I am a ..." (see lib/volunteers.js).
async function findPerson(phone) {
  const volunteer = unwrap(
    await db()
      .from("volunteers")
      .select("id,name,loyalty_points")
      .eq("phone", phone)
      .maybeSingle(),
    "find volunteer by phone"
  );
  if (volunteer) return { kind: "volunteer", row: volunteer };

  const beneficiary = unwrap(
    await db()
      .from("beneficiaries")
      .select("id,name,loyalty_points,vip_status")
      .eq("phone", phone)
      .maybeSingle(),
    "find beneficiary by phone"
  );
  if (beneficiary) return { kind: "beneficiary", row: beneficiary };

  return null;
}

const VOLUNTEER_THANKYOU = (name, points, eventName) =>
  `Thank you${name ? `, ${name}` : ""}, for volunteering at ${eventName}! 🙏 ` +
  `You've now earned ${points} point${points === 1 ? "" : "s"} with Passion To Serve.`;

const VIP_GRANTED = (name) =>
  `Congratulations${name ? `, ${name}` : ""}! 🎉 You're now a Passion To Serve ` +
  `VIP Pass holder — you get priority access at our next GIFTIK distribution ` +
  `event. Thank you for being part of our journey.`;

async function markVolunteerAttended({ person, event, phone, points }) {
  // ignoreDuplicates makes re-marking the same event a no-op instead of a
  // second point payout — see the unique(volunteer_id, event_id) constraint.
  unwrap(
    await db()
      .from("volunteer_event_log")
      .upsert(
        {
          volunteer_id: person.row.id,
          event_id: event.id,
          points,
          attended_at: new Date().toISOString(),
        },
        { onConflict: "volunteer_id,event_id", ignoreDuplicates: true }
      ),
    "log volunteer attendance"
  );

  const rows = unwrap(
    await db()
      .from("volunteer_event_log")
      .select("points")
      .eq("volunteer_id", person.row.id),
    "sum volunteer points"
  );
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0);

  unwrap(
    await db()
      .from("volunteers")
      .update({ loyalty_points: totalPoints })
      .eq("id", person.row.id),
    "update volunteer loyalty points"
  );

  // No tier ladder yet (see lib/config.js) — nothing to notify about beyond
  // a plain thank-you for this specific attendance. Best-effort: the points
  // above are already saved regardless of whether the send succeeds.
  let notified = false;
  try {
    const image = await renderVolunteerMilestoneImage({
      name: person.row.name,
      points: totalPoints,
      eventName: event.name,
    });
    await sendImage(toChatId(phone), {
      buffer: image,
      fileName: "volunteer-milestone.png",
      caption: VOLUNTEER_THANKYOU(person.row.name, totalPoints, event.name),
    });
    notified = true;
  } catch {
    // WhatsApp send failing must not roll back points already recorded.
  }

  return { kind: "volunteer", points: totalPoints, notified };
}

async function markBeneficiaryAttended({ person, event, phone, points }) {
  unwrap(
    await db()
      .from("beneficiary_activity_log")
      .upsert(
        {
          beneficiary_id: person.row.id,
          event_id: event.id,
          points,
          attended_at: new Date().toISOString(),
        },
        { onConflict: "beneficiary_id,event_id", ignoreDuplicates: true }
      ),
    "log beneficiary attendance"
  );

  const rows = unwrap(
    await db()
      .from("beneficiary_activity_log")
      .select("points")
      .eq("beneficiary_id", person.row.id),
    "read beneficiary activity log"
  );
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0);
  const attendanceCount = rows.length;

  const wasVip = Boolean(person.row.vip_status);
  const isVip = attendanceCount > VIP_THRESHOLD_ATTENDANCES;
  const justBecameVip = isVip && !wasVip;

  unwrap(
    await db()
      .from("beneficiaries")
      .update({ loyalty_points: totalPoints, vip_status: isVip })
      .eq("id", person.row.id),
    "update beneficiary loyalty status"
  );

  // Fires exactly once — the call that flips false -> true. A beneficiary
  // who's already VIP attending event #7 gets no repeat message.
  let notified = false;
  if (justBecameVip) {
    try {
      const image = await renderVipPassImage({
        name: person.row.name,
        attendanceCount,
      });
      await sendImage(toChatId(phone), {
        buffer: image,
        fileName: "vip-pass.png",
        caption: VIP_GRANTED(person.row.name),
      });
      notified = true;
    } catch {
      // VIP status is saved either way; the message can be resent by hand.
    }
  }

  return {
    kind: "beneficiary",
    points: totalPoints,
    attendanceCount,
    vipStatus: isVip,
    justBecameVip,
    notified,
  };
}

/**
 * Log one person's attendance at one event, by phone + campaign (event
 * name) — called from lib/handleWebhook.js the moment a "YES" RSVP is
 * recorded. Silently does nothing (not an error) if Supabase isn't
 * configured, the event isn't a real DB row, or the phone isn't in either
 * people table yet — a webhook handler must never throw on a routine RSVP.
 *
 * Idempotent: attending the same event twice never double-counts points
 * (unique constraint in the log tables), and the VIP-granted message fires
 * only on the one call that actually crosses the threshold.
 */
export async function markAttended({ campaign, phone }) {
  if (!loyaltyConfigured() || !phone || !campaign) return null;

  const event = await getEventByName(campaign);
  if (!event || event.readOnly) return null;
  const points = event.points_value ?? 1;

  const person = await findPerson(phone);
  if (!person) return null; // not in volunteers/beneficiaries yet — nothing to log

  return person.kind === "volunteer"
    ? markVolunteerAttended({ person, event, phone, points })
    : markBeneficiaryAttended({ person, event, phone, points });
}

/**
 * Undo a logged attendance — called when a "YES" flips to "NO" or a poll
 * vote is retracted, so a changed mind doesn't leave phantom points or an
 * unearned VIP flag behind. Recomputes the cached totals from what's left in
 * the log after the delete; never sends a "you lost VIP" message — that's an
 * edge case not worth the notification noise.
 */
export async function unmarkAttended({ campaign, phone }) {
  if (!loyaltyConfigured() || !phone || !campaign) return null;

  const event = await getEventByName(campaign);
  if (!event || event.readOnly) return null;

  const person = await findPerson(phone);
  if (!person) return null;

  if (person.kind === "volunteer") {
    unwrap(
      await db()
        .from("volunteer_event_log")
        .delete()
        .eq("volunteer_id", person.row.id)
        .eq("event_id", event.id),
      "remove volunteer attendance log"
    );
    const rows = unwrap(
      await db()
        .from("volunteer_event_log")
        .select("points")
        .eq("volunteer_id", person.row.id),
      "sum volunteer points"
    );
    const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0);
    unwrap(
      await db()
        .from("volunteers")
        .update({ loyalty_points: totalPoints })
        .eq("id", person.row.id),
      "update volunteer loyalty points"
    );
    return { kind: "volunteer", points: totalPoints };
  }

  unwrap(
    await db()
      .from("beneficiary_activity_log")
      .delete()
      .eq("beneficiary_id", person.row.id)
      .eq("event_id", event.id),
    "remove beneficiary attendance log"
  );
  const rows = unwrap(
    await db()
      .from("beneficiary_activity_log")
      .select("points")
      .eq("beneficiary_id", person.row.id),
    "read beneficiary activity log"
  );
  const totalPoints = rows.reduce((sum, r) => sum + (r.points || 0), 0);
  const attendanceCount = rows.length;
  const isVip = attendanceCount > VIP_THRESHOLD_ATTENDANCES;
  unwrap(
    await db()
      .from("beneficiaries")
      .update({ loyalty_points: totalPoints, vip_status: isVip })
      .eq("id", person.row.id),
    "update beneficiary loyalty status"
  );
  return { kind: "beneficiary", points: totalPoints, attendanceCount, vipStatus: isVip };
}

// Smart Waitlist & Auto-Backfill — when a confirmed volunteer's slot frees up,
// promote the next person on the waitlist automatically.
//
// The waitlist itself isn't a status anywhere — it's the FIFO overflow past
// an event's capacity, computed fresh by lib/headcount.js from `registrations`
// ordered by created_at. Promotion here just means "the next waitlisted
// person moves into the confirmed slice on the very next read" (nothing to
// write for that) plus a WhatsApp notice so they actually find out.

import { sendText, toChatId } from "./greenapi.js";
import { getWaitlistedVolunteers } from "./headcount.js";

/**
 * Who's first in line right now — call this BEFORE the write that frees their
 * slot commits. headcount.js's FIFO split is computed live from
 * `registrations`, so once a confirmed "yes" is overwritten/cleared, that
 * same query already counts the next person as confirmed, not waitlisted —
 * asking afterward always finds nobody waiting, even though the promotion
 * just happened.
 */
export async function peekNextWaitlisted(eventId) {
  const waitlisted = await getWaitlistedVolunteers(eventId);
  return waitlisted[0] || null;
}

/**
 * Tell someone already-promoted (per peekNextWaitlisted, taken before the
 * freeing write) that their spot is confirmed. Returns the person passed in,
 * or null if there was nobody.
 *
 * Best-effort on the notification: if the WhatsApp send fails, the person is
 * still promoted (they're already "yes" in registrations, first in FIFO
 * order) — losing the message costs them a heads-up, not their spot.
 */
export async function notifyPromoted(person, eventName) {
  if (!person) return null;

  try {
    await sendText(
      toChatId(person.phone),
      `Good news — a spot opened up for ${eventName}. You're in! 🎉`,
    );
  } catch {
    /* they're promoted either way; the notice is a courtesy, not the source of truth */
  }

  return person;
}

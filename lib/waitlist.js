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
 * Notify the next waitlisted volunteer that a spot opened up. Returns the
 * promoted { phone, name }, or null if nobody was waiting.
 *
 * Best-effort on the notification: if the WhatsApp send fails, the person is
 * still promoted (they're already "yes" in registrations, first in FIFO
 * order) — losing the message costs them a heads-up, not their spot.
 */
export async function promoteNextWaitlisted(eventId, eventName) {
  const waitlisted = await getWaitlistedVolunteers(eventId);
  const next = waitlisted[0];
  if (!next) return null;

  try {
    await sendText(
      toChatId(next.phone),
      `Good news — a spot opened up for ${eventName}. You're in! 🎉`,
    );
  } catch {
    /* they're promoted either way; the notice is a courtesy, not the source of truth */
  }

  return next;
}

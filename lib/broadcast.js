// Shared sequential-send-with-delay helper — ban-safety for GreenAPI's
// unofficial WhatsApp number. Never parallelise sends; always gap them.
//
// Used by app/api/send/route.js (organiser broadcasts) and
// app/api/cron/backup-alerts/route.js (automated backup-volunteer alerts) so
// both share one delay/opt-out/WhatsApp-check policy instead of drifting.

import { checkWhatsApp, sendPoll, sendText, toChatId } from "./greenapi.js";
import { getOptOuts } from "./store.js";
import { recordPollPrompt } from "./events.js";
import { SEND_DELAY_MS } from "./config.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send a plain-text message to each recipient, one at a time, with a delay
 * between sends. `{name}` in the message is replaced with the recipient's
 * first name. Returns per-recipient results: sent | skipped (opted out) |
 * failed (not on WhatsApp, or send error).
 */
export async function sendTextBroadcast(recipients, message) {
  const optOuts = await getOptOuts();
  const results = [];

  for (const r of recipients) {
    const phone = String(r.phone).replace(/[^\d]/g, "");

    if (optOuts.includes(phone)) {
      results.push({ ...r, status: "skipped", reason: "opted out" });
      continue;
    }

    try {
      if (!(await checkWhatsApp(phone))) {
        results.push({ ...r, status: "failed", reason: "not on WhatsApp" });
        continue;
      }

      const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
      await sendText(toChatId(phone), message.replaceAll("{name}", firstName));
      results.push({ ...r, status: "sent" });
    } catch (e) {
      results.push({ ...r, status: "failed", reason: e.message });
    }

    await sleep(SEND_DELAY_MS);
  }

  return results;
}

/**
 * Send a Yes/No poll to each recipient, one at a time, with a delay between
 * sends. Unlike a plain-text broadcast, a poll vote carries a stanzaId, which
 * lets the webhook resolve the reply back to `event` directly (via
 * recordPollPrompt) instead of guessing from question text or falling through
 * to the default campaign — the only way a reply to an out-of-band alert like
 * a backup-volunteer ask can land against the right event.
 */
export async function sendPollBroadcast(recipients, event, { intent } = {}) {
  const optOuts = await getOptOuts();
  const results = [];

  for (const r of recipients) {
    const phone = String(r.phone).replace(/[^\d]/g, "");

    if (optOuts.includes(phone)) {
      results.push({ ...r, status: "skipped", reason: "opted out" });
      continue;
    }

    try {
      if (!(await checkWhatsApp(phone))) {
        results.push({ ...r, status: "failed", reason: "not on WhatsApp" });
        continue;
      }

      const res = await sendPoll(toChatId(phone), event);
      if (event.id && res?.idMessage) {
        await recordPollPrompt({
          stanzaId: res.idMessage,
          eventId: event.id,
          intent,
        });
      }
      results.push({ ...r, status: "sent" });
    } catch (e) {
      results.push({ ...r, status: "failed", reason: e.message });
    }

    await sleep(SEND_DELAY_MS);
  }

  return results;
}

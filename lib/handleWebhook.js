// The inbound brain — TRANSPORT-AGNOSTIC on purpose.
//
// Two callers feed it the exact same webhook body:
//   • scripts/listen.js       (local: polls receiveNotification)
//   • app/api/webhook/route.js (deployed: GreenAPI POSTs here)
//
// Keeping the logic here means the demo path and the Vercel path can't drift.

import { sendText } from "./greenapi.js";
import { recordResponse, clearResponse, addOptOut } from "./store.js";
import { eventForStanza, listEvents } from "./events.js";
import { EVENT } from "./config.js";
import { markAttended, unmarkAttended } from "./loyalty.js";

// Map an option label (or free text) to a clean "yes"/"no"/null.
export function classifyAnswer(text) {
  const t = String(text || "").toLowerCase();
  if (/(^|\b)(yes|y|yeah|yep|in|join|ok|okay|confirm)\b/.test(t) || t.includes("i'm in")) return "yes";
  if (/(^|\b)(no|n|nope|can'?t|cannot|out|skip)\b/.test(t)) return "no";
  return null;
}

// From a pollUpdate webhook, find which option THIS sender voted for.
// `votes` is the FULL tally for the whole poll, not just this person's answer,
// so we have to search the optionVoters lists for their id.
export function voterChoice(pollMessageData, senderChatId) {
  for (const vote of pollMessageData?.votes || []) {
    if ((vote.optionVoters || []).includes(senderChatId)) return vote.optionName;
  }
  return null; // vote retracted
}

// Reduce a question to a comparison key: lowercase, letters and digits only.
// Exact equality is too brittle — the question goes out through GreenAPI and
// comes back inside a webhook, and a re-encoded emoji or a curly quote would
// file the RSVP under a phantom campaign, leaving the roster mysteriously empty.
function questionKey(text) {
  return String(text || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]/gu, "");
}

/**
 * Which campaign does this vote belong to?
 *
 * 1. stanzaId → poll_prompts → event  (exact; recorded when the poll was sent)
 * 2. question text match against known events
 * 3. the config event, or the poll's own name
 *
 * The fallbacks matter: if stanzaId ever fails to line up with the id GreenAPI
 * returns from sendPoll, votes still land rather than vanishing.
 */
async function campaignFor(pollName, stanzaId) {
  const viaStanza = await eventForStanza(stanzaId);
  if (viaStanza) return viaStanza;

  const key = questionKey(pollName);
  if (!pollName || key === questionKey(EVENT.question)) return EVENT.campaign;

  try {
    const match = (await listEvents()).find(
      (e) => questionKey(e.question) === key
    );
    if (match) return match.name;
  } catch {
    // Events unavailable — fall through to the poll's own name.
  }
  return pollName;
}

const CONFIRM = {
  yes: "You're on the list — thank you! We'll send event details closer to the day. 🙏",
  no: "No worries, thanks for letting us know. Hope to see you at the next one!",
};

/**
 * Handle one GreenAPI webhook body.
 * Returns a short summary of what happened, for logging.
 */
export async function handleWebhook(body, { log = console.log } = {}) {
  if (!body) return null;
  if (body.typeWebhook !== "incomingMessageReceived") return null;

  const chatId = body.senderData?.sender;
  const phone = String(chatId || "").split("@")[0];
  const name = body.senderData?.senderName || body.senderData?.senderContactName || phone;
  const md = body.messageData || {};

  let rawAnswer = null;
  let campaign = EVENT.campaign;

  switch (md.typeMessage) {
    case "pollUpdateMessage": {
      campaign = await campaignFor(
        md.pollMessageData?.name,
        md.pollMessageData?.stanzaId
      );
      const choice = voterChoice(md.pollMessageData, chatId);
      if (!choice) {
        // Vote retracted — drop them off the roster, and undo any loyalty
        // credit that RSVP had already earned (best-effort: a loyalty hiccup
        // must not break the retraction itself).
        await clearResponse({ phone, campaign });
        try {
          await unmarkAttended({ campaign, phone });
        } catch (e) {
          log(`   (loyalty reversal failed: ${e.message})`);
        }
        log(`↩️  ${name} retracted their vote`);
        return { type: "retracted", phone, name };
      }
      rawAnswer = choice;
      break;
    }
    case "textMessage":
      rawAnswer = md.textMessageData?.textMessage;
      break;
    case "extendedTextMessage":
      rawAnswer = md.extendedTextMessageData?.text;
      break;
    default:
      return null; // images, stickers, etc.
  }

  // PDPA opt-out takes priority over everything else.
  if (/^\s*stop\s*$/i.test(rawAnswer || "")) {
    await addOptOut(phone);
    log(`🚫 ${name} opted out`);
    try {
      await sendText(chatId, "You've been removed from our list. Thank you for your time. 🙏");
    } catch {}
    return { type: "optout", phone, name };
  }

  const answer = classifyAnswer(rawAnswer);
  if (!answer) return null; // couldn't interpret — ignore quietly

  const entry = await recordResponse({ phone, name, answer, campaign, raw: rawAnswer });
  log(`${answer === "yes" ? "✅" : "❌"} ${name} → ${answer.toUpperCase()}  ("${rawAnswer}")`);

  // Loyalty Programme / VIP Pass: "YES" is the attendance signal (see
  // lib/loyalty.js) — a switch to "NO" undoes whatever credit the earlier
  // "YES" had already earned. Best-effort either way: this must never block
  // the RSVP confirmation below.
  try {
    if (answer === "yes") await markAttended({ campaign, phone });
    else await unmarkAttended({ campaign, phone });
  } catch (e) {
    log(`   (loyalty update failed: ${e.message})`);
  }

  try {
    await sendText(chatId, CONFIRM[answer]);
  } catch (e) {
    log(`   (couldn't send confirmation: ${e.message})`);
  }

  return { type: "rsvp", ...entry };
}

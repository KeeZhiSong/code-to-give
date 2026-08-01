// The inbound brain — TRANSPORT-AGNOSTIC on purpose.
//
// Two callers feed it the exact same webhook body:
//   • scripts/listen.js       (local: polls receiveNotification)
//   • app/api/webhook/route.js (deployed: GreenAPI POSTs here)
//
// Keeping the logic here means the demo path and the Vercel path can't drift.

import { sendText } from "./greenapi.js";
import {
  recordResponse,
  clearResponse,
  addOptOut,
  removeOptOut,
  getOptOuts,
} from "./store.js";
import { eventForStanza, listEvents, getEventByName } from "./events.js";
import {
  formatConfirmation,
  formatLoyaltyReply,
  formatNeedsHuman,
  formatRejoin,
  POINTS_KEYWORDS,
  STOP_KEYWORDS,
  START_KEYWORDS,
  STOP_CONFIRMATION,
} from "./eventMessage.js";
import { getLoyaltySummary } from "./loyalty.js";
import { classifyFreeText } from "./aiReply.js";
import { EVENT } from "./config.js";

// NOTE: loyalty CREDITS are deliberately not awarded here.
//
// An RSVP is a promise, not attendance — someone who replies "YES" and then
// doesn't turn up shouldn't earn points or a VIP Pass. Crediting on the reply
// also sends a branded image on every single YES, which is a lot of traffic
// for an unofficial WhatsApp number to survive.
//
// Attendance is credited once, by an organiser, from the roster — see
// markEventAttended in lib/volunteers.js, which is the only writer and keeps
// events_attended and the points ledger in step.
//
// Reading loyalty here is fine, and is how the "POINTS" lookup below works.

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

/**
 * Build the reply someone gets after voting.
 *
 * Looks the event up so the reply can name it and repeat the essentials — with
 * several events running, "You're on the list" doesn't say which. The lookup is
 * best-effort: a slow or failing query must never cost someone their RSVP, so
 * it falls back to wording that works without an event.
 */
async function confirmationFor(campaign, answer) {
  let event = null;
  try {
    event = await getEventByName(campaign);
  } catch {
    /* fall through to the generic wording */
  }
  return formatConfirmation(event, answer);
}

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
        // Vote retracted — drop them off the roster. Loyalty is untouched on
        // purpose: nothing was credited on the RSVP, so there's nothing to
        // reverse. See the note above the loyalty import.
        await clearResponse({ phone, campaign });
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
  if (STOP_KEYWORDS.test(rawAnswer || "")) {
    await addOptOut(phone);
    log(`🚫 ${name} opted out`);
    try {
      await sendText(chatId, STOP_CONFIRMATION);
    } catch {}
    return { type: "optout", phone, name };
  }

  // …and the way back. Consent withdrawn isn't consent withdrawn forever: a
  // mistyped STOP, a shared phone, or a change of heart shouldn't lock someone
  // out of the programme permanently.
  if (START_KEYWORDS.test(rawAnswer || "")) {
    let alreadyOn = true;
    try {
      alreadyOn = !(await getOptOuts()).includes(phone);
      if (!alreadyOn) await removeOptOut(phone);
    } catch (e) {
      log(`   (rejoin failed: ${e.message})`);
    }
    log(`✅ ${name} rejoined`);
    try {
      // senderName is a WhatsApp display name, not necessarily their real one,
      // so only greet with it when it isn't just the number echoed back.
      await sendText(
        chatId,
        formatRejoin(name === phone ? "" : name, alreadyOn)
      );
    } catch {}
    return { type: "rejoin", phone, name };
  }

  // "POINTS" and friends — a volunteer checking their own standing. The site
  // is organiser-facing, so WhatsApp is the only place they can ask.
  //
  // Checked BEFORE classifyAnswer: none of these words look like yes or no
  // today, but the two must never be allowed to compete for the same message.
  if (POINTS_KEYWORDS.test(rawAnswer || "")) {
    let summary = null;
    try {
      summary = await getLoyaltySummary(phone);
    } catch (e) {
      log(`   (loyalty lookup failed: ${e.message})`);
    }
    try {
      await sendText(chatId, formatLoyaltyReply(summary));
    } catch (e) {
      log(`   (couldn't send points reply: ${e.message})`);
    }
    log(`🏅 ${name} asked for their points`);
    return { type: "points", phone, name };
  }

  let answer = classifyAnswer(rawAnswer);
  let viaAi = false;

  if (!answer) {
    // Regex couldn't place it — try the AI fallback before giving up quietly.
    // Best-effort event lookup: a slow or failing query must not cost anyone
    // their RSVP, so the fallback still runs (with no event facts) if it fails.
    let event = null;
    try {
      event = await getEventByName(campaign);
    } catch {
      /* fall through with no event facts */
    }

    const fallback = await classifyFreeText(rawAnswer, event);

    if (fallback?.intent === "yes" || fallback?.intent === "no") {
      answer = fallback.intent;
      viaAi = true;
    } else if (fallback?.intent === "question") {
      // Answered from the event's own facts, or — if those facts don't cover
      // it — a redirect to a human rather than silence. Never both empty.
      const answered = Boolean(fallback.answer);
      const reply = fallback.answer || formatNeedsHuman(event);
      log(
        answered
          ? `🤖 ${name} asked a question — answered from event details ("${rawAnswer}")`
          : `🤖 ${name} asked a question we can't answer — pointed them to a human ("${rawAnswer}")`
      );
      try {
        await sendText(chatId, reply);
      } catch (e) {
        log(`   (couldn't send AI reply: ${e.message})`);
      }
      return { type: "question", phone, name, question: rawAnswer, answered };
    } else {
      return null; // still couldn't interpret — ignore quietly
    }
  }

  const entry = await recordResponse({ phone, name, answer, campaign, raw: rawAnswer });
  log(
    `${answer === "yes" ? "✅" : "❌"} ${name} → ${answer.toUpperCase()}` +
      `${viaAi ? " (AI-classified)" : ""}  ("${rawAnswer}")`
  );

  try {
    await sendText(chatId, await confirmationFor(campaign, answer));
  } catch (e) {
    log(`   (couldn't send confirmation: ${e.message})`);
  }

  return { type: "rsvp", ...entry };
}

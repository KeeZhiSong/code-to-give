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
  getResponses,
} from "./store.js";
import {
  eventForStanza,
  listEvents,
  getEventByName,
  getEvent,
  nextUpcomingEvent,
} from "./events.js";
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
import { peekNextWaitlisted, notifyPromoted } from "./waitlist.js";
import {
  getWaitlistedVolunteers,
  isConfirmedVolunteer,
} from "./headcount.js";
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
  if (
    /(^|\b)(yes|y|yeah|yep|in|join|ok|okay|confirm)\b/.test(t) ||
    t.includes("i'm in")
  )
    return "yes";
  if (/(^|\b)(no|n|nope|can'?t|cannot|out|skip)\b/.test(t)) return "no";
  return null;
}

// From a pollUpdate webhook, find which option THIS sender voted for.
// `votes` is the FULL tally for the whole poll, not just this person's answer,
// so we have to search the optionVoters lists for their id.
export function voterChoice(pollMessageData, senderChatId) {
  for (const vote of pollMessageData?.votes || []) {
    if ((vote.optionVoters || []).includes(senderChatId))
      return vote.optionName;
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
 *
 * Returns { campaign, eventId }. eventId is only set when it came off the
 * exact stanzaId → poll_prompts → event lookup — the other two paths only
 * know a name, and the caller (recordResponse et al.) will resolve that name
 * to an id itself. Only the stanzaId path is exact enough to bypass that
 * name lookup, which is a separate resolver that can create a duplicate
 * `events` row if the name doesn't match exactly.
 */
async function campaignFor(pollName, stanzaId) {
  const viaStanza = await eventForStanza(stanzaId);
  if (viaStanza)
    return { campaign: viaStanza.name || pollName, eventId: viaStanza.id };

  const key = questionKey(pollName);
  if (!pollName || key === questionKey(EVENT.question))
    return { campaign: EVENT.campaign, eventId: null };

  try {
    const match = (await listEvents()).find(
      (e) => questionKey(e.question) === key,
    );
    if (match) return { campaign: match.name, eventId: match.id };
  } catch {
    // Events unavailable — fall through to the poll's own name.
  }
  return { campaign: pollName, eventId: null };
}

/**
 * Build the reply someone gets after voting.
 *
 * Looks the event up so the reply can name it and repeat the essentials — with
 * several events running, "You're on the list" doesn't say which. The lookup is
 * best-effort: a slow or failing query must never cost someone their RSVP, so
 * it falls back to wording that works without an event.
 */
async function confirmationFor(campaign, answer, eventId) {
  let event = null;
  try {
    event = await eventFor(campaign, eventId);
  } catch {
    /* fall through to the generic wording */
  }
  return formatConfirmation(event, answer);
}

const WAITLIST_CONFIRMATION =
  "Thanks for the reply! This event is currently at capacity, so you're on " +
  "the waitlist — we'll message you the moment a spot opens up. 🙏";

// Best-effort event lookup for a campaign — prefers the exact id when the
// caller has one (from campaignFor's stanzaId path) over the name-based
// lookup, which is a separate resolver that can create a duplicate `events`
// row if the name doesn't match exactly.
async function eventFor(campaign, eventId) {
  return eventId ? await getEvent(eventId) : await getEventByName(campaign);
}

// A "yes" only waitlists someone if the event caps capacity and they landed
// past it — an event with no capacity set never waitlists anyone.
async function isWaitlisted(campaign, phone, eventId) {
  try {
    const event = await eventFor(campaign, eventId);
    if (!event || event.capacity == null) return false;
    const waitlisted = await getWaitlistedVolunteers(event.id);
    return waitlisted.some((v) => v.phone === phone);
  } catch {
    // Can't tell — default to the confirmed message rather than block the reply.
    return false;
  }
}

// Who's first in line for this event's waitlist, BEFORE the write that may
// free their slot commits. headcount.js's FIFO split is computed live from
// `registrations`, so asking this same question AFTER the write always finds
// the answer "nobody" — the freed slot has already rolled them into
// "confirmed" by then. Returns null when there's no capacity gate (nothing to
// backfill) or nobody waiting yet.
async function nextWaitlistedBeforeChange(campaign, eventId) {
  try {
    const event = await eventFor(campaign, eventId);
    if (!event || event.capacity == null) return null;
    return { event, candidate: await peekNextWaitlisted(event.id) };
  } catch {
    // Can't tell — skip the backfill rather than block the reply.
    return null;
  }
}

// A dropped "yes" only frees a capacity-gated slot — an event with no
// capacity set has no waitlist to backfill, so skip the lookup entirely.
async function backfillIfSlotFreed(pending, log) {
  if (!pending?.candidate) return;
  try {
    const promoted = await notifyPromoted(
      pending.candidate,
      pending.event.name,
    );
    if (promoted) {
      log(
        `⬆️  promoted ${promoted.name} (${promoted.phone}) off the waitlist for ${pending.event.name}`,
      );
    }
  } catch (e) {
    // Best-effort — losing the backfill costs a delayed promotion, not the
    // cancellation itself, which has already been recorded.
    log(`   (waitlist backfill failed: ${e.message})`);
  }
}

// Was this phone holding a confirmed slot for the campaign? Used to tell a
// genuine cancellation (frees a slot) from a first-time "no" (doesn't).
//
// Checking only for a recorded "yes" isn't enough once an event has capacity:
// someone who said yes but landed on the WAITLIST is holding no slot, so
// their cancellation frees nothing. Treating that as a cancellation promotes
// — and congratulates — the next person in the queue, who has not in fact
// moved up. Worse, the waitlist is oldest-first, so the person at its head is
// often the canceller themselves, who then gets told "a spot opened up,
// you're in!" as they leave.
async function wasConfirmedYes(campaign, phone, eventId) {
  const rows = await getResponses(campaign, eventId);
  if (!rows.some((r) => r.phone === phone && r.answer === "yes")) return false;

  // No event id (or no Supabase) means no capacity model to consult — fall
  // back to the old behaviour rather than dropping the backfill entirely.
  if (!eventId) return true;
  try {
    return await isConfirmedVolunteer(eventId, phone);
  } catch {
    return true;
  }
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
  const name =
    body.senderData?.senderName || body.senderData?.senderContactName || phone;
  const md = body.messageData || {};

  let rawAnswer = null;
  let campaign = EVENT.campaign;
  let eventId = null;

  switch (md.typeMessage) {
    case "pollUpdateMessage": {
      ({ campaign, eventId } = await campaignFor(
        md.pollMessageData?.name,
        md.pollMessageData?.stanzaId,
      ));
      const choice = voterChoice(md.pollMessageData, chatId);
      if (!choice) {
        // Vote retracted — drop them off the roster. Loyalty is untouched on
        // purpose: nothing was credited on the RSVP, so there's nothing to
        // reverse. See the note above the loyalty import.
        //
        // Only a freed CONFIRMED slot needs backfilling — a waitlisted person
        // retracting frees nobody, so check BEFORE the clear wipes the prior
        // answer.
        const wasYes = await wasConfirmedYes(campaign, phone, eventId);
        const pending = wasYes
          ? await nextWaitlistedBeforeChange(campaign, eventId)
          : null;
        await clearResponse({ phone, campaign, eventId });
        log(`↩️  ${name} retracted their vote`);
        if (pending) await backfillIfSlotFreed(pending, log);
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
        formatRejoin(name === phone ? "" : name, alreadyOn),
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
    // eventFor, not getEventByName: when the stanzaId path gave us an exact
    // id, the name lookup is a separate resolver that can land on a duplicate
    // `events` row — and answering someone's question from the wrong row's
    // venue is worse than not answering it.
    let event = null;
    try {
      event = await eventFor(campaign, eventId);
      // A free-text question carries no poll id, so `campaign` is whatever
      // CAMPAIGN happens to say — a hand-maintained name that goes stale when
      // an event is renamed or deleted. Rather than answer "I don't know" with
      // the facts sitting in the next row, assume they mean the next event.
      if (!event) event = await nextUpcomingEvent();
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
      const reply = fallback.answer || formatNeedsHuman(event, fallback.unavailableMessage);
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

  // A "no" that overwrites a prior "yes" is a cancellation — check BEFORE the
  // overwrite so there's still a prior answer to compare against. An
  // AI-classified "no" is a cancellation exactly like a keyword one, so this
  // sits after the fallback has had its say and reads whatever `answer` ended
  // up as.
  const wasYes =
    answer === "no" && (await wasConfirmedYes(campaign, phone, eventId));
  const pending = wasYes
    ? await nextWaitlistedBeforeChange(campaign, eventId)
    : null;

  const entry = await recordResponse({
    phone,
    name,
    answer,
    campaign,
    raw: rawAnswer,
    eventId,
  });
  log(
    `${answer === "yes" ? "✅" : "❌"} ${name} → ${answer.toUpperCase()}` +
      `${viaAi ? " (AI-classified)" : ""}  ("${rawAnswer}")`,
  );

  if (pending) await backfillIfSlotFreed(pending, log);

  const waitlisted =
    answer === "yes" && (await isWaitlisted(campaign, phone, eventId));

  try {
    await sendText(
      chatId,
      waitlisted
        ? WAITLIST_CONFIRMATION
        : await confirmationFor(campaign, answer, eventId),
    );
  } catch (e) {
    log(`   (couldn't send confirmation: ${e.message})`);
  }

  return { type: "rsvp", ...entry, waitlisted };
}

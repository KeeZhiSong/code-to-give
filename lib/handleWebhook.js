// The inbound brain — TRANSPORT-AGNOSTIC on purpose.
//
// Two callers feed it the exact same webhook body:
//   • scripts/listen.js       (local: polls receiveNotification)
//   • app/api/webhook/route.js (deployed: GreenAPI POSTs here)
//
// Keeping the logic here means the demo path and the Vercel path can't drift.

import { sendText } from "./greenapi.js";
import { recordResponse, clearResponse, addOptOut } from "./store.js";
import { EVENT } from "./config.js";

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

// Poll votes carry the question text; use it to keep separate events apart.
function campaignFor(pollName) {
  if (!pollName || pollName === EVENT.question) return EVENT.campaign;
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
      campaign = campaignFor(md.pollMessageData?.name);
      const choice = voterChoice(md.pollMessageData, chatId);
      if (!choice) {
        // Vote retracted — drop them off the roster.
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

  try {
    await sendText(chatId, CONFIRM[answer]);
  } catch (e) {
    log(`   (couldn't send confirmation: ${e.message})`);
  }

  return { type: "rsvp", ...entry };
}

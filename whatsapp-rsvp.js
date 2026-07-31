/**
 * Passion To Serve — WhatsApp RSVP tool (GreenAPI, Node.js)
 * -----------------------------------------------------------
 * Sends a Yes/No poll to volunteers and captures their responses.
 * Uses the POLLING approach (receiveNotification) so it runs locally
 * with NO webhook / deployment needed.
 *
 * SETUP
 *   1. Node 18+ (uses built-in fetch — no npm install needed).
 *   2. Token: put GREENAPI_TOKEN in .env.local (see .env.local.example).
 *      Never hardcode it here — this file is committed.
 *   3. ONE TIME — turn on the poll-vote webhook for this instance:
 *        node whatsapp-rsvp.js setup
 *      Without this, GreenAPI never delivers poll votes and the
 *      listener sits there silently forever.
 *
 * USAGE
 *   Check everything is wired up correctly:
 *     node whatsapp-rsvp.js doctor
 *
 *   Start the responder loop (leave this running in one terminal):
 *     node whatsapp-rsvp.js listen
 *
 *   In another terminal, send the RSVP poll to one or more numbers:
 *     node whatsapp-rsvp.js send 6591234567
 *     node whatsapp-rsvp.js send 6591234567 6598887777
 *
 *   Then vote on your phone and watch the roster build in the "listen" terminal.
 */

import "./lib/loadEnv.js"; // must stay first — populates process.env from .env.local

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// All three come from the environment. The token must NEVER be hardcoded here —
// this file is committed, and a token in the repo is a token you have to rotate.
const CONFIG = {
  apiUrl: process.env.GREENAPI_API_URL || "https://7107.api.greenapi.com",
  idInstance: process.env.GREENAPI_ID_INSTANCE || "710722697368",
  apiToken: process.env.GREENAPI_TOKEN || "",
};

if (!CONFIG.apiToken) {
  console.error(
    "GREENAPI_TOKEN is not set. Add it to .env.local (see .env.local.example)."
  );
  process.exit(1);
}

// The event this poll is for (edit per event).
const EVENT = {
  question: "Join Sunday's GIFTIK distribution drive? 🙌",
  options: ["Yes, I'm in", "Can't make it"],
};

// Set to true to log every webhook that arrives, including ones we ignore.
// Useful when "nothing is happening" and you need to see if anything is landing.
const VERBOSE = process.env.RSVP_VERBOSE === "1";

// ─── In-memory roster (resets on restart) ────────────────────────────────────
// TODO (Phase 4): replace this Map with a write to Supabase so the website
// dashboard reads the same data.
const rsvps = new Map(); // chatId -> { name, answer, at }

// ─── GreenAPI helpers ────────────────────────────────────────────────────────
// URL shape is always:  {apiUrl}/waInstance{id}/{method}/{token}[/{extra}]
// The token is ALWAYS the last segment before any extra path parts — getting
// this backwards returns a bare 401 with an empty body.
function endpoint(method, extra = "") {
  const tail = extra ? `/${extra}` : "";
  return `${CONFIG.apiUrl}/waInstance${CONFIG.idInstance}/${method}/${CONFIG.apiToken}${tail}`;
}

async function callApi(method, body, httpMethod = "POST") {
  const opts = { method: httpMethod, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(endpoint(method), opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} failed: HTTP ${res.status} ${text || "(empty body)"}`);
  }
  return text ? JSON.parse(text) : null;
}

// Normalize a bare number ("+65 9123 4567") into a chatId ("6591234567@c.us")
function toChatId(number) {
  if (String(number).includes("@")) return number;
  return String(number).replace(/[^\d]/g, "") + "@c.us";
}

async function checkWhatsApp(number) {
  const digits = String(number).replace(/[^\d]/g, "");
  const res = await callApi("checkWhatsapp", { phoneNumber: Number(digits) });
  return res && res.existsWhatsapp;
}

async function sendPoll(chatId) {
  return callApi("sendPoll", {
    chatId,
    message: EVENT.question,
    options: EVENT.options.map((o) => ({ optionName: o })),
    multipleAnswers: false,
  });
}

async function sendText(chatId, message) {
  return callApi("sendMessage", { chatId, message });
}

async function receiveNotification() {
  // Long-polls ~5s. Returns { receiptId, body }, or null when nothing is waiting
  // (GreenAPI answers 200 with a literal `null` body in that case).
  const res = await fetch(endpoint("receiveNotification"), { method: "GET" });
  if (res.status !== 200) return null;
  const text = await res.text();
  if (!text || text === "null") return null;
  const data = JSON.parse(text);
  return data && data.receiptId ? data : null;
}

async function deleteNotification(receiptId) {
  // receiptId goes AFTER the token: .../deleteNotification/{token}/{receiptId}
  const res = await fetch(endpoint("deleteNotification", receiptId), { method: "DELETE" });
  if (!res.ok) {
    // Must not fail silently: an undeleted notification is handed back forever,
    // which wedges the listener on one message and looks like a dead script.
    throw new Error(`deleteNotification(${receiptId}) failed: HTTP ${res.status}`);
  }
}

// ─── Interpreting responses ──────────────────────────────────────────────────
// Map an option label (or free text) to a clean "yes"/"no"/null.
function classifyAnswer(text) {
  const t = String(text).toLowerCase();
  if (/(^|\b)(yes|y|yeah|yep|in|join|ok|okay|confirm)\b/.test(t) || t.includes("i'm in")) return "yes";
  if (/(^|\b)(no|n|nope|can'?t|cannot|out|skip)\b/.test(t)) return "no";
  return null;
}

// From a pollUpdate webhook, find which option THIS sender voted for.
function voterChoice(pollMessageData, senderChatId) {
  for (const vote of pollMessageData?.votes || []) {
    if ((vote.optionVoters || []).includes(senderChatId)) return vote.optionName;
  }
  return null; // vote retracted
}

async function recordRsvp(chatId, name, rawAnswer) {
  const answer = classifyAnswer(rawAnswer);
  if (!answer) {
    if (VERBOSE) console.log(`   (couldn't interpret "${rawAnswer}" from ${name || chatId} — ignored)`);
    return;
  }

  rsvps.set(chatId, { name: name || chatId, answer, at: new Date().toISOString() });

  const emoji = answer === "yes" ? "✅" : "❌";
  console.log(`${emoji} ${name || chatId} → ${answer.toUpperCase()}  ("${rawAnswer}")`);
  printRoster();

  // Confirmation reply back to the volunteer.
  const reply =
    answer === "yes"
      ? "You're on the list — thank you! We'll send event details closer to the day. 🙏"
      : "No worries, thanks for letting us know. Hope to see you at the next one!";
  try {
    await sendText(chatId, reply);
  } catch (e) {
    console.error("  (couldn't send confirmation:", e.message, ")");
  }
}

function printRoster() {
  const going = [...rsvps.values()].filter((r) => r.answer === "yes");
  const notGoing = [...rsvps.values()].filter((r) => r.answer === "no");
  console.log(
    `   📋 Roster — Going: ${going.length} | Not going: ${notGoing.length}` +
      (going.length ? `\n      In: ${going.map((r) => r.name).join(", ")}` : "")
  );
}

// ─── Webhook router ──────────────────────────────────────────────────────────
async function handle(body) {
  if (!body) return;
  if (body.typeWebhook !== "incomingMessageReceived") {
    if (VERBOSE) console.log(`   · ignored webhook: ${body.typeWebhook}`);
    return;
  }

  const sender = body.senderData?.sender;
  const name = body.senderData?.senderName || body.senderData?.senderContactName;
  const md = body.messageData || {};

  switch (md.typeMessage) {
    case "pollUpdateMessage": {
      const choice = voterChoice(md.pollMessageData, sender);
      if (choice) await recordRsvp(sender, name, choice);
      else if (VERBOSE) console.log(`   · ${name || sender} retracted their vote`);
      break;
    }
    case "textMessage":
      await recordRsvp(sender, name, md.textMessageData?.textMessage);
      break;
    case "extendedTextMessage":
      await recordRsvp(sender, name, md.extendedTextMessageData?.text);
      break;
    default:
      // images, stickers, etc. — nothing to do for RSVP
      if (VERBOSE) console.log(`   · ignored message type: ${md.typeMessage}`);
      break;
  }
}

// ─── Preflight ───────────────────────────────────────────────────────────────
// Poll votes only arrive if BOTH incomingWebhook and pollMessageWebhook are on.
async function preflight({ strict = true } = {}) {
  const state = await callApi("getStateInstance", null, "GET");
  console.log(`   instance state : ${state?.stateInstance}`);
  if (state?.stateInstance !== "authorized") {
    console.error("❌ Instance is not authorized — scan the QR code in the GreenAPI console first.");
    if (strict) process.exit(1);
    return false;
  }

  const s = await callApi("getSettings", null, "GET");
  console.log(`   linked number  : ${s?.wid}`);
  console.log(`   incomingWebhook: ${s?.incomingWebhook}`);
  console.log(`   pollMessageWebhook: ${s?.pollMessageWebhook}`);

  const missing = [];
  if (s?.incomingWebhook !== "yes") missing.push("incomingWebhook");
  if (s?.pollMessageWebhook !== "yes") missing.push("pollMessageWebhook");

  if (missing.length) {
    console.error(
      `\n❌ ${missing.join(" and ")} is OFF — GreenAPI will never deliver ` +
        `poll votes, so the listener would sit silent forever.\n` +
        `   Fix it with:  node whatsapp-rsvp.js setup\n`
    );
    if (strict) process.exit(1);
    return false;
  }

  console.log("   ✅ webhooks configured correctly\n");
  return true;
}

async function setup() {
  console.log("Enabling incomingWebhook + pollMessageWebhook on this instance...");
  await callApi("setSettings", { incomingWebhook: "yes", pollMessageWebhook: "yes" });
  console.log(
    "✅ Settings sent. GreenAPI reboots the instance to apply them — wait ~1 minute,\n" +
      "   then run:  node whatsapp-rsvp.js doctor"
  );
}

// ─── Raw webhook inspector ───────────────────────────────────────────────────
// Prints the COMPLETE JSON of every notification as it arrives, and appends it
// to webhooks.jsonl so you have real samples to code against.
//
// NOTE: this deletes each notification after printing it — that is the only way
// the queue advances. Don't run this at the same time as `listen`, or they will
// steal messages from each other.
async function dump() {
  const fs = require("fs");
  const LOG = "webhooks.jsonl";

  await preflight({ strict: false });
  console.log(`🔍 Dumping raw webhooks. Vote on a poll or send a text to this number.`);
  console.log(`   Full JSON also appended to ${LOG}   (Ctrl+C to stop)\n`);

  while (true) {
    try {
      const notif = await receiveNotification();
      if (!notif) continue;

      const { receiptId, body } = notif;
      const kind =
        body?.typeWebhook === "incomingMessageReceived"
          ? `${body.typeWebhook} / ${body.messageData?.typeMessage}`
          : body?.typeWebhook;

      console.log("─".repeat(70));
      console.log(`receiptId ${receiptId}  —  ${kind}`);
      console.log("─".repeat(70));
      console.log(JSON.stringify(body, null, 2));
      console.log();

      fs.appendFileSync(LOG, JSON.stringify(body) + "\n");
      await deleteNotification(receiptId);
    } catch (e) {
      console.error("dump error:", e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ─── Main loops ──────────────────────────────────────────────────────────────
async function listen() {
  console.log("Checking instance...");
  await preflight();

  console.log("👂 Listening for RSVP responses...  (Ctrl+C to stop)\n");
  while (true) {
    try {
      const notif = await receiveNotification();
      if (notif) {
        await handle(notif.body);
        await deleteNotification(notif.receiptId); // IMPORTANT: clears it from the queue
      }
    } catch (e) {
      console.error("poll error:", e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function sendToNumbers(numbers) {
  for (const num of numbers) {
    const chatId = toChatId(num);
    try {
      const ok = await checkWhatsApp(num);
      if (!ok) {
        console.log(`⚠️  ${num} is not on WhatsApp — skipping.`);
        continue;
      }
      await sendPoll(chatId);
      console.log(`📤 Poll sent to ${num}`);
    } catch (e) {
      console.error(`❌ Failed to send to ${num}:`, e.message);
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────
(async () => {
  const [mode, ...args] = process.argv.slice(2);

  if (!CONFIG.apiToken || CONFIG.apiToken.startsWith("PASTE_")) {
    console.error('Set your token first: $env:GREENAPI_TOKEN = "..."  (or edit CONFIG.apiToken)');
    process.exit(1);
  }

  try {
    if (mode === "send") {
      if (!args.length) return console.error("Usage: node whatsapp-rsvp.js send <number> [<number> ...]");
      await sendToNumbers(args);
    } else if (mode === "listen") {
      await listen();
    } else if (mode === "doctor") {
      await preflight({ strict: false });
    } else if (mode === "setup") {
      await setup();
    } else if (mode === "dump") {
      await dump();
    } else {
      console.log(
        "Usage:\n" +
          "  node whatsapp-rsvp.js setup    (one time — enables poll webhooks)\n" +
          "  node whatsapp-rsvp.js doctor   (check config)\n" +
          "  node whatsapp-rsvp.js dump     (print raw webhook JSON)\n" +
          "  node whatsapp-rsvp.js listen\n" +
          "  node whatsapp-rsvp.js send <number> [<number> ...]"
      );
    }
  } catch (e) {
    console.error("Fatal:", e.message);
    process.exit(1);
  }
})();

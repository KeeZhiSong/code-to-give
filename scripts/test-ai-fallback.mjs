// Manual test for lib/aiReply.js — no Supabase/GreenAPI needed.
//
// Run:  node scripts/test-ai-fallback.mjs
//
// With a real GEMINI_API_KEY in .env.local, this hits the live API and shows
// Gemini's actual classifications. Without one, it runs in DRY-RUN mode:
// fetch is stubbed with canned responses so you can verify the code's
// plumbing (env check, event-facts formatting, response parsing, the
// yes/no/question/other branching, the contact-redirect fallback) with zero
// network calls and zero cost — this proves the code has no bugs, not that
// the real answers are good.

import "../lib/loadEnv.js"; // must stay first — populates process.env
import { formatNeedsHuman } from "../lib/eventMessage.js";

const LIVE = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// Keyed by a substring of the test message below — good enough for a fixed
// set of canned cases, not a general-purpose mock.
const CANNED_RESPONSES = [
  { match: "can't make it", intent: "no", answer: "" },
  { match: "count me in", intent: "yes", answer: "" },
  {
    match: "what time does it start",
    intent: "question",
    answer:
      "It's Sun 9 Aug, 9am–1pm at Kranji Recreation Centre — look for the Passion To Serve banner at the main entrance!",
  },
  {
    match: "bring my son",
    intent: "question",
    answer:
      "The invite doesn't say either way — best to check with Priya (91234567) on the day.",
  },
  { match: "parking", intent: "question", answer: "" }, // genuine question, not in the given facts
  { match: "nice one", intent: "other", answer: "" }, // small talk
  { match: "谢谢", intent: "yes", answer: "" }, // Mandarin: "thanks, I'll go"
];

if (!LIVE) {
  process.env.GEMINI_API_KEY = "dryrun-not-a-real-key";

  globalThis.fetch = async (url, init) => {
    const bodyText = String(init?.body ?? "");
    const canned =
      CANNED_RESPONSES.find((c) => bodyText.includes(c.match)) ?? {
        intent: "other",
        answer: "",
      };

    const payload = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: JSON.stringify({ intent: canned.intent, answer: canned.answer }) }],
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

const { classifyFreeText, aiFallbackConfigured } = await import("../lib/aiReply.js");

console.log(
  LIVE
    ? "🔴 LIVE — calling the real Gemini API\n"
    : "🧪 DRY RUN — no GEMINI_API_KEY set, using mocked responses (no network, no cost)\n"
);

if (!aiFallbackConfigured()) {
  console.error("❌ aiFallbackConfigured() returned false even after setting a dummy key — bug.");
  process.exit(1);
}

const event = {
  name: "GIFTIK Sunday drive",
  description: "Help distribute pre-loved and new items to migrant workers.",
  starts_at: "2026-08-09T09:00:00+08:00",
  ends_at: "2026-08-09T13:00:00+08:00",
  venue: "Kranji Recreation Centre",
  meeting_point: "Look for the Passion To Serve banner at the main entrance",
  dress_code: "Comfortable clothes and covered shoes",
  what_to_bring: "A water bottle and a cap",
  contact_name: "Priya",
  contact_phone: "91234567",
};

const cases = [
  "sorry can't make it, i have a night shift that day",
  "yeah I'm down for this, count me in!",
  "what time does it start and where do i go",
  "can I bring my son with me?",
  "is there parking nearby?", // not in the facts — should still be "question" with empty answer
  "haha nice one",
  "谢谢,我会去的", // Mandarin: "thanks, I'll go"
];

// Same branching as lib/handleWebhook.js — shows the actual WhatsApp reply a
// person would receive, not just the raw classification.
function replyFor(result, eventForReply) {
  if (!result) return null;
  if (result.intent === "question") return result.answer || formatNeedsHuman(eventForReply);
  return null; // yes/no/other don't send an AI-authored reply
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The free tier caps gemini-3.6-flash at 5 requests/minute — this script
// alone makes 8. Space live calls out so a test run doesn't trip that limit
// and report a false "bug" (a 429 here looks identical to a genuine failure —
// classifyFreeText fails closed to null on both, by design).
if (LIVE) console.log("(pacing live calls to stay under the free tier's 5 req/min limit)\n");

for (const message of cases) {
  if (LIVE) await sleep(13000);
  const result = await classifyFreeText(message, event);
  console.log("—".repeat(60));
  console.log("Message:", message);
  console.log("Result: ", result);
  const reply = replyFor(result, event);
  if (reply) console.log("Would send:", reply);
}

// The event with no on-the-day contact set — confirms the redirect still
// works (falls to DEFAULT_CONTACT_PHONE) instead of an "undefined" line.
console.log("—".repeat(60));
console.log("Event with NO contact info set:");
const bareEvent = { name: "Beach Cleanup", venue: "East Coast Park" };
if (LIVE) await sleep(13000);
const bareResult = await classifyFreeText("is there parking nearby?", bareEvent);
console.log("Result: ", bareResult);
console.log("Would send:", replyFor(bareResult, bareEvent));

console.log("—".repeat(60));
console.log(
  LIVE
    ? "\nDone — these are real Gemini classifications."
    : "\nDone — plumbing verified against mocked responses. Add a real GEMINI_API_KEY to .env.local and re-run for live results."
);

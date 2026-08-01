// Classify a single WhatsApp-style message — costs exactly one API call,
// unlike test-ai-fallback.mjs which runs a fixed suite of 8.
//
// Run:  node scripts/classify-one.mjs "sorry can't make it"
// Optionally pass event fields as JSON in a second argument:
//   node scripts/classify-one.mjs "what time does it start" '{"venue":"East Coast Park"}'

import "../lib/loadEnv.js"; // must stay first — populates process.env
import { classifyFreeText, aiFallbackConfigured } from "../lib/aiReply.js";
import { formatNeedsHuman } from "../lib/eventMessage.js";

const message = process.argv[2];
if (!message) {
  console.error('Usage: node scripts/classify-one.mjs "your test message" [eventJson]');
  process.exit(1);
}

const event = process.argv[3]
  ? JSON.parse(process.argv[3])
  : {
      name: "GIFTIK Sunday drive",
      description: "Help distribute pre-loved and new items to migrant workers.",
      starts_at: "2026-08-09T09:00:00+08:00",
      venue: "Kranji Recreation Centre",
      contact_name: "Priya",
      contact_phone: "91234567",
    };

if (!aiFallbackConfigured()) {
  console.error("❌ GEMINI_API_KEY not set — add it to .env.local first.");
  process.exit(1);
}

console.log("Message:", message);
const result = await classifyFreeText(message, event);
console.log("Result: ", result);

if (result?.intent === "question") {
  console.log("Would send:", result.answer || formatNeedsHuman(event));
}

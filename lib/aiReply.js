// AI fallback for inbound WhatsApp replies that classifyAnswer can't place.
//
// classifyAnswer only recognises a handful of literal keywords (yes/no/stop/
// start/points). Everything else — a real sentence, a question, a reply in
// another language — used to be silently dropped (see the comment above
// classifyAnswer's call site in handleWebhook.js). This asks Gemini (free
// tier) to do two things in one call: decide whether the message is actually
// a yes/no in disguise, and if it reads as a question, draft an answer using
// ONLY the event's own fields. Anything it isn't confident about comes back
// as intent "other" and is left alone — same silent-ignore behaviour as
// before this existed.

import { GoogleGenAI, Type } from "@google/genai";
import { PTS_KNOWLEDGE } from "./knowledge.js";
import { formatWhen } from "./eventMessage.js";

let client = null;
function gemini() {
  // Auto-detects GEMINI_API_KEY (or GOOGLE_API_KEY) — nothing to pass here.
  if (!client) client = new GoogleGenAI({});
  return client;
}

export function aiFallbackConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

// The "lite" tier, not the flagship flash model: this is a plain classify-
// and-maybe-answer call, not deep reasoning, and lite models carry a much
// higher free-tier daily quota (the flagship gemini-3.6-flash free tier is
// capped at 20 requests/DAY per project — unusable for a real webhook with
// more than a couple of testers).
const MODEL = "gemini-3.5-flash-lite";

// OpenAPI-style schema (Gemini's structured-output format, not plain JSON
// Schema) — forces the response to be exactly {intent, answer} instead of
// free text, so there's no tool-call block to hunt for in the response.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ["yes", "no", "question", "other"],
      description:
        "'yes'/'no' only if the message clearly means they will or won't " +
        "attend, even if phrased conversationally. 'question' for ANY " +
        "genuine question about the event — whether or not the given facts " +
        "answer it (see `answer`). 'other' for anything that isn't a " +
        "question at all — small talk, unrelated messages, gibberish.",
    },
    answer: {
      type: Type.STRING,
      description:
        "Only when intent is 'question'. If the facts given answer it, a " +
        "short, friendly WhatsApp-style reply using ONLY those facts — " +
        "never invent a detail. If the facts DON'T cover it, leave this " +
        "empty rather than guessing — the app will point them to a human " +
        "instead. Empty string for every other intent. Write the answer in " +
        "the SAME LANGUAGE as the incoming message — if they asked in Tamil, " +
        "answer in Tamil, etc.",
    },
    unavailableMessage: {
      type: Type.STRING,
      description:
        "Only when intent is 'question' AND `answer` is empty (the facts " +
        "don't cover it): a short, warm one-sentence message — in the SAME " +
        "LANGUAGE as the incoming message — saying this isn't something you " +
        "can answer and someone will follow up. Do NOT include a phone " +
        "number, contact name, or any instruction on how to reach anyone — " +
        "the app appends real contact details separately, in a form you " +
        "can't be trusted to get right. Empty string in every other case.",
    },
  },
  required: ["intent", "answer", "unavailableMessage"],
};

const SYSTEM_INSTRUCTION =
  `${PTS_KNOWLEDGE}\n\n` +
  "You read one WhatsApp message replying to a volunteer event invite. " +
  "Classify it and, for genuine questions about the event, draft a short " +
  "answer using ONLY the facts given below — or, if those facts don't " +
  "cover the question, leave `answer` empty and instead write " +
  "`unavailableMessage`, per the response schema's field descriptions. " +
  "Reply in whatever language the incoming message was written in, not " +
  "necessarily English. Respond with JSON matching the given schema only.";

/** Render the event's own fields as plain facts — the fallback's entire
 *  knowledge base. Deliberately small: no vector DB, no retrieval, just the
 *  row already fetched for this campaign. */
function eventFacts(event) {
  if (!event || event.readOnly) return "No event details are available.";

  const lines = [];
  if (event.name) lines.push(`Event: ${event.name}`);
  if (event.description) lines.push(`Description: ${event.description}`);
  // Human-readable local time (e.g. "Sun 9 Aug, 9:00am – 1:00pm"), not the
  // raw UTC timestamp — a model asked "what time" from a bare ISO string
  // answers literally in UTC, which is correct and useless to a volunteer
  // who has no idea what that is in their own timezone.
  const when = formatWhen(event.starts_at, event.ends_at);
  if (when) lines.push(`When: ${when}`);
  if (event.venue) lines.push(`Venue: ${event.venue}`);
  if (event.meeting_point) lines.push(`Meeting point: ${event.meeting_point}`);
  if (event.dress_code) lines.push(`Dress code: ${event.dress_code}`);
  if (event.what_to_bring) lines.push(`What to bring: ${event.what_to_bring}`);
  const contact = [event.contact_name, event.contact_phone].filter(Boolean).join(" · ");
  if (contact) lines.push(`On-the-day contact: ${contact}`);

  return lines.length > 0 ? lines.join("\n") : "No event details are available.";
}

/**
 * Classify one inbound free-text message that the regex classifier
 * (classifyAnswer) couldn't place, using the given event as the sole source
 * of truth for any answer. Never throws — a slow or failing model call must
 * cost nothing more than falling back to "ignore quietly", the behaviour
 * before this existed. Returns null when unconfigured, empty, or on error.
 */
export async function classifyFreeText(rawText, event) {
  if (!aiFallbackConfigured() || !rawText?.trim()) return null;

  try {
    const res = await gemini().models.generateContent({
      model: MODEL,
      contents: `Event facts:\n${eventFacts(event)}\n\nMessage: "${rawText}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // A plain classify-and-maybe-answer call doesn't need deep reasoning —
        // left at the model's default, this model can burn most of a modest
        // token budget on internal "thinking" before writing any JSON at all,
        // hitting MAX_TOKENS with empty output. thinkingBudget: 0 (fully off)
        // 400s on this model; MINIMAL is the accepted low setting.
        thinkingConfig: { thinkingLevel: "MINIMAL" },
        maxOutputTokens: 1024,
      },
    });

    if (!res.text) return null;
    const { intent, answer, unavailableMessage } = JSON.parse(res.text) || {};
    if (!["yes", "no", "question", "other"].includes(intent)) return null;
    return {
      intent,
      answer: typeof answer === "string" ? answer.trim() : "",
      unavailableMessage:
        typeof unavailableMessage === "string" ? unavailableMessage.trim() : "",
    };
  } catch {
    return null;
  }
}

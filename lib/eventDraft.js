// Turn one line of an organiser's shorthand into a filled-in event form.
//
// "GIFTIK drive at Kranji Rec Centre next Sunday 9am-1pm, bring a reusable
// bag, ask for Chermaine" becomes a name, a pillar, a venue, a start and end,
// what to bring, and a contact — which the organiser then corrects and saves.
//
// This exists because half the events in the database have a name and a date
// and nothing else, so the WhatsApp briefing they'd send is thin. The barrier
// was never that organisers don't know the details; it's that filling eleven
// fields on a phone between other jobs is work nobody does.
//
// It DRAFTS. It never saves. Everything lands in the form for a human to
// change, because a model that guesses a venue is only useful if someone
// checks it.

import { GoogleGenAI, Type } from "@google/genai";
import { PTS_KNOWLEDGE } from "./knowledge.js";
import { TIMEZONE } from "./config.js";

let client = null;
function gemini() {
  if (!client) client = new GoogleGenAI({});
  return client;
}

export function eventDraftConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

// Same model and reasoning as the reply fallback — see lib/aiReply.js for why
// the lite tier rather than the flagship.
const MODEL = "gemini-3.5-flash-lite";

// Kept in step with BLANK_EVENT in lib/ui/format.js. Fields the organiser
// alone should decide — capacity, points, status — are deliberately absent:
// a model has no basis for inventing how many volunteers a drive needs.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Short event name, title case. Empty if the text doesn't imply one." },
    pillar: {
      type: Type.STRING,
      description:
        "Exactly one of 'Items To Serve', 'Knowledge To Serve', 'Peace To Serve', " +
        "or empty if unclear. Distribution and collection drives are Items; " +
        "classes and workshops are Knowledge; wellness and recreation are Peace.",
    },
    starts_at: { type: Type.STRING, description: "ISO 8601 with timezone offset, or empty if no time was given. Never guess a date that wasn't stated." },
    ends_at: { type: Type.STRING, description: "ISO 8601 with timezone offset, or empty. Only if an end time was stated or clearly implied by a range." },
    venue: { type: Type.STRING, description: "Place name only. Empty if not stated." },
    meeting_point: { type: Type.STRING, description: "Where to gather on arrival, if stated. Empty otherwise." },
    what_to_bring: { type: Type.STRING, description: "What a volunteer should bring, if stated. Empty otherwise." },
    dress_code: { type: Type.STRING, description: "If stated. Empty otherwise." },
    contact_name: { type: Type.STRING, description: "On-the-day contact's name, if stated. Empty otherwise." },
    contact_phone: { type: Type.STRING, description: "On-the-day contact's number, ONLY if one appears in the text. Never invent one." },
    description: {
      type: Type.STRING,
      description:
        "Two or three warm, plain sentences a volunteer would read on WhatsApp, " +
        "describing what the event is and what they'd be doing. This is the one " +
        "field you may expand beyond the input, using what you know about Passion " +
        "To Serve — but never state a fact (a time, a place, a partner) that " +
        "wasn't given.",
    },
    question: {
      type: Type.STRING,
      description:
        "The WhatsApp poll question, e.g. \"Join Sunday's GIFTIK distribution drive? 🙌\". " +
        "Short, warm, ends in a question mark. One emoji at most.",
    },
  },
  required: [
    "name", "pillar", "starts_at", "ends_at", "venue", "meeting_point",
    "what_to_bring", "dress_code", "contact_name", "contact_phone",
    "description", "question",
  ],
};

/**
 * Draft an event from a line of shorthand.
 *
 * Never throws and never hangs — same contract as the reply fallback. A
 * failure here means the organiser types the form themselves, which is what
 * they were doing before. Returns null when unconfigured, empty, or too slow.
 */
export async function draftEvent(text, now = new Date()) {
  if (!eventDraftConfigured() || !text?.trim()) return null;

  // Relative dates ("next Sunday") are meaningless without an anchor, and the
  // model's idea of "today" is whenever it was trained. Both the current date
  // and the timezone have to be stated or it will quietly answer in UTC.
  const today = now.toLocaleDateString("en-SG", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let timer;
  try {
    const res = await Promise.race([
      gemini().models.generateContent({
        model: MODEL,
        contents: `Today is ${today} in ${TIMEZONE}.\n\nOrganiser's note:\n"${text}"`,
        config: {
          systemInstruction:
            `${PTS_KNOWLEDGE}\n\n` +
            "You turn an organiser's shorthand note into a draft event record. " +
            `Times are in ${TIMEZONE} — emit ISO 8601 with the correct offset. ` +
            "Leave a field EMPTY rather than guessing: a blank the organiser " +
            "fills in costs them five seconds, a wrong venue costs a volunteer " +
            "a wasted trip across the city. Respond with JSON matching the " +
            "given schema only.",
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
          maxOutputTokens: 2048,
        },
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("draft timed out")), 12000);
      }),
    ]);

    if (!res.text) return null;
    const parsed = JSON.parse(res.text) || {};

    // Only pass through fields we asked for, as strings — the form binds these
    // straight to inputs and an unexpected shape would break rendering.
    const out = {};
    for (const key of Object.keys(RESPONSE_SCHEMA.properties)) {
      const v = parsed[key];
      out[key] = typeof v === "string" ? v.trim() : "";
    }
    // datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, not an
    // offset-bearing ISO string — the browser silently rejects the latter and
    // the organiser sees an empty box with no explanation.
    out.starts_at = toLocalInput(out.starts_at);
    out.ends_at = toLocalInput(out.ends_at);
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** ISO with offset → the "YYYY-MM-DDTHH:mm" a datetime-local input accepts,
 *  rendered in the event's timezone rather than the server's. */
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

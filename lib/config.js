// Central config. Everything here is read server-side only — never imported
// into a client component, so the token can't leak into the browser bundle.
//
// Local dev reads .env.local. On Vercel, set the same keys as Environment
// Variables and nothing else needs to change.

export const GREENAPI = {
  apiUrl: process.env.GREENAPI_API_URL || "https://7107.api.greenapi.com",
  idInstance: process.env.GREENAPI_ID_INSTANCE || "710722697368",
  apiToken: process.env.GREENAPI_TOKEN || "",
};

// Delay between sends, in ms. Ban-safety: never blast a queue with no gap.
// This sits ON TOP of the instance's own delaySendMessagesMilliseconds (500).
export const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS || 1500);

// Volunteers type local numbers into the Google Form ("91234567"), but GreenAPI
// needs full international format ("6591234567"). Bare local numbers are prefixed
// with this. Set to "" to disable and require fully-qualified numbers.
export const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? "65";

// Local mobile length for the country above — SG mobiles are 8 digits starting 8 or 9.
export const LOCAL_MOBILE = /^[89]\d{7}$/;

// Optional: published Google Sheet CSV URL for the contacts list.
// Sheet → File → Share → Publish to web → CSV. If unset, we read data/volunteers.json.
export const SHEET_CSV_URL = process.env.SHEET_CSV_URL || "";

// How many days out an event has to be for the backup-alert cron to consider
// it "close enough" to chase a shortfall.
export const BACKUP_ALERT_DAYS_OUT = Number(
  process.env.BACKUP_ALERT_DAYS_OUT || 3,
);

// Shared secret the cron job's Authorization header must match — without this
// /api/cron/backup-alerts would be another unauthenticated send endpoint.
export const CRON_SECRET = process.env.CRON_SECRET || "";

// The event this poll is for (edit per event).
export const EVENT = {
  campaign: process.env.CAMPAIGN || "GIFTIK Sunday drive",
  question: "Join Sunday's GIFTIK distribution drive? 🙌",
  options: ["Yes, I'm in", "Can't make it"],
};

// ─── Loyalty / VIP Pass ───────────────────────────────────────────────────────
// A beneficiary becomes VIP once their logged attendances (courses + events
// like GIFTIK, see beneficiary_activity_log) exceed this count — "more than
// 3" per the brainstorm note, i.e. the 4th attendance triggers it.
export const VIP_THRESHOLD_ATTENDANCES = Number(
  process.env.VIP_THRESHOLD_ATTENDANCES || 3,
);

// Volunteer tier ladder. Highest first — tierFor walks down and takes the
// first threshold the points clear.
//
// Deliberately reachable: at 1 point per event, Bronze is your first drive and
// Gold is ten. A ladder nobody climbs is just a number with a colour.
export const LOYALTY_TIERS = [
  { name: "Gold", min: 10 },
  { name: "Silver", min: 5 },
  { name: "Bronze", min: 1 },
];

/** The tier these points earn, or null below the first rung. */
export function tierFor(points) {
  return LOYALTY_TIERS.find((t) => points >= t.min)?.name || null;
}

/** The next rung up, and how many points away it is. Null at the top. */
export function nextTierFor(points) {
  const higher = LOYALTY_TIERS.filter((t) => points < t.min);
  if (higher.length === 0) return null;
  const next = higher[higher.length - 1]; // the nearest one above
  return { name: next.name, needed: next.min - points };
}

export function assertConfigured() {
  if (!GREENAPI.apiToken) {
    throw new Error(
      "GREENAPI_TOKEN is not set. Add it to .env.local (see .env.local.example).",
    );
  }
}

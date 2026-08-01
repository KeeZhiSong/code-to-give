// Shared presentational helpers. Pure — safe in client components.

/** Volunteers who signed up before a form question existed have a blank value
 *  for it. They must stay visible under "All" — never silently dropped. */
export const ANY = "__any__";

/**
 * Show only the last four digits. An organiser console sits on a laptop in a
 * cafe or gets screen-shared in a demo; a full roster of volunteer numbers has
 * no business being readable over someone's shoulder.
 */
export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `••••${digits.slice(-4)}` : "—";
}

/**
 * Roster entries fall back to the raw number when WhatsApp supplies no display
 * name (see lib/store.js), so an unmasked number can arrive dressed as a name.
 */
export function displayName(entry) {
  if (!entry.name || entry.name === entry.phone) return maskPhone(entry.phone);
  return entry.name;
}

export function formatWhen(value) {
  if (!value) return "no date set";
  return new Date(value).toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-08-09T09:00:00+00:00" -> "2026-08-09T09:00" for <input datetime-local>. */
export function toLocalInput(value) {
  return value ? String(value).slice(0, 16) : "";
}

export const PILLARS = [
  "Items To Serve",
  "Knowledge To Serve",
  "Peace To Serve",
];

export const BLANK_EVENT = {
  name: "",
  pillar: "",
  track: "",
  starts_at: "",
  ends_at: "",
  venue: "",
  capacity: "",
  points_value: "",
  question: "",
  // Event details (migration 008) — all optional; blanks drop their line
  // from the WhatsApp message.
  description: "",
  what_to_bring: "",
  dress_code: "",
  meeting_point: "",
  confirm_yes: "",
  confirm_no: "",
  contact_name: "",
  contact_phone: "",
  status: "open",
};

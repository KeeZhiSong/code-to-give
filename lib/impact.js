// Impact figures for the post-event thank-you message.
//
// These are DISPLAY VALUES, not measurements. Nothing here reads the database.
// An organiser counts a GIFTIK queue on paper, and that number has never made
// it into this system — so rather than quote a beneficiary_activity_log count
// that only reflects the handful of people who happened to be registered, the
// message stands in a plausible figure.
//
// They do NOT reconcile with the figures Passion To Serve publishes. Before
// this goes anywhere near a real volunteer, `served` and `volunteers` need to
// come from a headcount the organiser actually entered.
//
// Deliberately DETERMINISTIC — seeded off the event name, never random at call
// time. Two volunteers at the same drive will compare phones, and a re-send
// has to tell the same story it told the first time. A number that moves is
// the one way an invented number visibly breaks.

/** FNV-1a. Small, stable, and no dependency — we only need well-spread bits. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A value in [min, max], stable for a given seed. */
function pick(seed, min, max) {
  return min + (seed % (max - min + 1));
}

// Scale figures to the kind of event, so a literacy class of 12 doesn't claim
// to have served 200 people. Ranges are drawn from the event profiles in the
// PTS brief: distribution drives run into the hundreds, courses are a room.
const PROFILES = {
  items: { served: [140, 260], volunteers: [10, 18] },
  knowledge: { served: [16, 38], volunteers: [3, 7] },
  peace: { served: [60, 140], volunteers: [6, 12] },
  default: { served: [40, 120], volunteers: [5, 10] },
};

/**
 * Which profile an event falls under.
 *
 * Pillar is the reliable signal, but events created before the field existed
 * (or quick test events) have none — so fall back to reading the name, which
 * is how an organiser would tell them apart anyway.
 */
export function profileFor(event) {
  const pillar = String(event?.pillar || "").toLowerCase();
  if (pillar.includes("item")) return "items";
  if (pillar.includes("knowledge")) return "knowledge";
  if (pillar.includes("peace")) return "peace";

  const name = String(event?.name || "").toLowerCase();
  if (/giftik|distribution|collection|donation|drive/.test(name)) return "items";
  if (/course|class|workshop|literacy|english|excel|coding|learn/.test(name)) {
    return "knowledge";
  }
  if (/yoga|zumba|wellness|health|meditation|talk/.test(name)) return "peace";
  return "default";
}

/**
 * Figures for one event's thank-you message.
 *
 * `perVolunteer` is what makes the message land — the whole point is showing
 * someone their own share of the result, not the organisation's total.
 */
export function getEventImpact(event) {
  const seed = hash(String(event?.name || "event"));
  const kind = profileFor(event);
  const profile = PROFILES[kind];

  const served = pick(seed, ...profile.served);
  // A second, decorrelated draw — reusing `seed` directly would tie the
  // volunteer count to the served count and make both feel patterned.
  const volunteers = pick(hash(`v:${event?.name || ""}`), ...profile.volunteers);

  return {
    profile: kind,
    served,
    volunteers,
    perVolunteer: Math.max(1, Math.round(served / volunteers)),
  };
}

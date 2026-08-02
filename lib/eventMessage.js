// Every word a volunteer reads on WhatsApp is built here.
//
// One formatter, three callers — the invite (app/api/send), the RSVP
// confirmation (lib/handleWebhook), and reminders when they exist. Writing the
// copy once is the point: three copies drift, and the volunteer is the one who
// notices when the invite and the confirmation disagree about the venue.
//
// Every field is optional. A blank one drops its line rather than printing an
// empty label, so a half-filled event still produces a sensible message.

import { DEFAULT_CONTACT_PHONE } from "./config.js";

/** Keywords a volunteer can text in to check their standing. */
export const POINTS_KEYWORDS = /^\s*(points?|my ?points?|balance|loyalty|tier|vip)\s*[?.!]*\s*$/i;

/** Leaving the list. */
export const STOP_KEYWORDS = /^\s*(stop|unsubscribe|remove me)\s*[?.!]*\s*$/i;

/**
 * Coming back to it.
 *
 * Deliberately excludes a bare "join": classifyAnswer reads it as a yes, and
 * rejoin is checked first, so someone replying "join" to a poll meaning "yes,
 * I'll join" would have been answered with a rejoin message instead of being
 * put on the roster. "rejoin" is unambiguous; a bare "join" is not.
 */
export const START_KEYWORDS = /^\s*(start|resume|subscribe|rejoin)\s*[?.!]*\s*$/i;

/**
 * Confirming an opt-out.
 *
 * Names the way back. Withdrawing consent has to be honoured, but it doesn't
 * have to be permanent, and someone who meant "not this event" shouldn't
 * silently leave the organisation.
 */
export const STOP_CONFIRMATION =
  "You've been removed from our list — you won't get any more messages from " +
  "us. Thank you for the time you've given us. 🙏\n\n" +
  "_Changed your mind? Text_ *START* _any time to come back._";

/** Confirming a rejoin. `alreadyOn` covers texting START without having left. */
export function formatRejoin(name, alreadyOn) {
  const hi = name ? `Welcome back, ${name}!` : "Welcome back!";
  if (alreadyOn) {
    return (
      "You're already on our list — you'll hear from us about upcoming " +
      "events. 🙏\n\n_Text_ *STOP* _any time to opt out._"
    );
  }
  return (
    `${hi} 💚 You're back on our list and we'll let you know about upcoming ` +
    "events.\n\n_Text_ *POINTS* _to see your volunteering history, or_ " +
    "*STOP* _to opt out again._"
  );
}

/**
 * The reply to "POINTS".
 *
 * Volunteers count in points and tiers; beneficiaries count in visits, because
 * what they care about is the VIP Pass. `null` means we don't recognise the
 * number — say so kindly and point at the form rather than staying silent.
 */
export function formatLoyaltyReply(summary) {
  if (!summary) {
    return (
      "We don't have this number on our volunteer list yet 🤔\n\n" +
      "Sign up through our Google Form and you'll start earning points at your " +
      "first event."
    );
  }

  const hi = summary.name ? `Hi ${summary.name}` : "Hi there";

  if (summary.kind === "beneficiary") {
    const lines = [
      `⭐ ${hi} — you've joined ${summary.attendanceCount} Passion To Serve ` +
        `session${summary.attendanceCount === 1 ? "" : "s"}.`,
    ];
    lines.push(
      summary.vipStatus
        ? "*VIP Pass: active* — priority access at our next GIFTIK event. 🎉"
        : summary.needed === 1
          ? "1 more session and your VIP Pass unlocks."
          : `${summary.needed} more sessions and your VIP Pass unlocks.`
    );
    if (summary.events.length > 0) {
      lines.push(summary.events.map((e) => `• ${e}`).join("\n"));
    }
    return lines.join("\n\n");
  }

  // Nobody has earned anything yet — encourage rather than report a zero.
  if (summary.points === 0) {
    return (
      `🏅 ${hi} — you're on our volunteer list, and you haven't earned any ` +
      "points yet.\n\nJoin an event and you'll pick up your first one. We'll " +
      "message you when the next one is open."
    );
  }

  const lines = [
    `🏅 ${hi} — you have *${summary.points} point${summary.points === 1 ? "" : "s"}* ` +
      "with Passion To Serve.",
  ];
  if (summary.tier) lines.push(`Tier: *${summary.tier}*`);
  if (summary.events.length > 0) {
    lines.push(
      `Events you've joined:\n${summary.events.map((e) => `• ${e}`).join("\n")}`
    );
  }
  if (summary.next) {
    lines.push(
      `${summary.next.needed} more point${summary.next.needed === 1 ? "" : "s"} ` +
        `to reach *${summary.next.name}*.`
    );
  } else {
    lines.push("You're at our highest tier — thank you for everything. 🙏");
  }
  return lines.join("\n\n");
}

/**
 * When the AI fallback (lib/aiReply.js) recognises a genuine question but the
 * event's own facts don't cover it — point at a human instead of guessing.
 *
 * The contact info is built here, not by the model: the model is never
 * trusted to state a phone number, so a wrong one can't reach a volunteer.
 * Falls back to DEFAULT_CONTACT_PHONE when the event has no on-the-day
 * contact set, same as every other optional field in this file.
 *
 * `intro` is the model's own translated "I can't answer this" line (see
 * `unavailableMessage` in lib/aiReply.js) — it's free-text in whatever
 * language the sender used, but never contains contact details, so mixing it
 * with the contact line below can't put a wrong number in front of anyone.
 * Falls back to the English default when the AI didn't supply one.
 */
export function formatNeedsHuman(event, intro) {
  const opening = intro?.trim() || "Good question — that's not something I can answer for you.";
  const contact = [event?.contact_name?.trim(), event?.contact_phone?.trim()]
    .filter(Boolean)
    .join(" · ");
  const reachable = contact || DEFAULT_CONTACT_PHONE;
  // No English wrapper words around the contact line — it has to read
  // cleanly appended after an intro in any language, not just English.
  return reachable ? `${opening}\n\n📞 ${reachable}` : `${opening} 🙏`;
}

const DEFAULT_CONFIRM_YES = "You're on the list";
const DEFAULT_CONFIRM_NO =
  "No worries, thanks for letting us know. Hope to see you at the next one!";

/** "Sun 3 Aug, 9:00am – 1:00pm", or just the start if there's no end. */
export function formatWhen(startsAt, endsAt) {
  if (!startsAt) return null;
  const start = new Date(startsAt);
  const day = start.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = (d) =>
    d
      .toLocaleTimeString("en-SG", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase()
      .replace(" ", "");

  if (!endsAt) return `${day}, ${time(start)}`;

  const end = new Date(endsAt);
  // A same-day range reads as one line; anything else gets both dates.
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return `${day}, ${time(start)} – ${time(end)}`;
  const endDay = end.toLocaleDateString("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time(start)} – ${endDay}, ${time(end)}`;
}

/** Venue plus meeting point, when both are known. */
function formatWhere(event) {
  const venue = (event.venue || "").trim();
  const meet = (event.meeting_point || "").trim();
  if (venue && meet) return `${venue} — ${meet}`;
  return venue || meet || null;
}

/** "4 hours", "1 hour 30 min" — only when both ends are known. */
function formatDuration(startsAt, endsAt) {
  if (!startsAt || !endsAt) return null;
  const mins = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
  );
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h} hour${h === 1 ? "" : "s"} ${m} min`;
}

/**
 * The full briefing sent ahead of the poll.
 *
 * Written to read like a message from an organisation rather than an automated
 * blast: it greets by name, says what the event is and what they'll be doing,
 * gives the practical facts in a scannable block, names a human to look for on
 * the day, and closes by telling them what they can text back. A volunteer who
 * gets this should have no remaining question before they answer the poll.
 *
 * `{name}` is left in place for the send route to merge per recipient — the
 * message is built once and personalised on the way out.
 *
 * Every field is optional. A blank one drops its line rather than printing an
 * empty label, so a half-filled event still produces something sensible.
 */
export function formatEventDetails(event) {
  if (!event) return "";

  const blocks = [];

  blocks.push("Hi {name}! 👋");
  blocks.push(`You're invited to join *${event.name}* with *Passion To Serve*.`);

  // What it is, and what they'd actually be doing.
  const body = event.description?.trim();
  if (body) blocks.push(body);

  // The practical block — scannable, one fact per line.
  const facts = [];
  const when = formatWhen(event.starts_at, event.ends_at);
  const duration = formatDuration(event.starts_at, event.ends_at);
  if (when) facts.push(`🗓  ${when}${duration ? `  ·  ${duration}` : ""}`);
  if (event.venue?.trim()) facts.push(`📌  ${event.venue.trim()}`);
  if (event.meeting_point?.trim()) facts.push(`🚩  ${event.meeting_point.trim()}`);
  if (event.dress_code?.trim()) facts.push(`👕  ${event.dress_code.trim()}`);
  if (event.what_to_bring?.trim()) facts.push(`🎒  ${event.what_to_bring.trim()}`);

  // Someone to look for, and someone to call if they're lost.
  const contact = [event.contact_name?.trim(), event.contact_phone?.trim()]
    .filter(Boolean)
    .join(" · ");
  if (contact) facts.push(`☎️  On the day: ${contact}`);

  if (facts.length > 0) blocks.push(facts.join("\n"));

  blocks.push(
    "Tap an option on the poll below to let us know if you can make it."
  );
  blocks.push(
    "_Text_ *POINTS* _any time to see your volunteering history, or_ *STOP* " +
      "_to stop receiving these._"
  );
  blocks.push("— Passion To Serve 💚");

  return blocks.join("\n\n");
}

/**
 * The automatic reply after someone votes.
 *
 * "yes" repeats the essentials — a volunteer shouldn't have to scroll back up
 * to find the venue — and names the event, which matters once more than one is
 * running. It also states how to cancel: changing a poll vote already works,
 * but nobody had ever been told that.
 */
export function formatConfirmation(event, answer) {
  if (answer === "no") {
    return event?.confirm_no?.trim() || DEFAULT_CONFIRM_NO;
  }

  const opening =
    event?.confirm_yes?.trim() ||
    (event?.name ? `${DEFAULT_CONFIRM_YES} for *${event.name}*` : DEFAULT_CONFIRM_YES);

  const parts = [`${opening} 🙏`];

  const essentials = [];
  const when = formatWhen(event?.starts_at, event?.ends_at);
  if (when) essentials.push(`🗓 ${when}`);
  const where = formatWhere(event || {});
  if (where) essentials.push(`📌 ${where}`);
  if (event?.what_to_bring?.trim()) {
    essentials.push(`🎒 ${event.what_to_bring.trim()}`);
  }
  if (essentials.length > 0) parts.push(essentials.join("\n"));

  parts.push("Can't make it any more? Just change your answer on the poll.");

  return parts.join("\n\n");
}

// What the volunteer's hours actually became, in the language of the pillar
// they served under. The middle paragraph of the thank-you: the one that has
// to describe a person rather than a total.
const IMPACT_LINES = {
  items: (served, where) =>
    `${served} migrant workers came through ${where} today. They went home with clothes, kitchenware and school supplies — small things that are hard to find room for on a construction wage.`,
  knowledge: (served, where) =>
    `${served} people sat down to learn at ${where} today. Some of them will use it to send an email home in their own words for the first time, or to finally understand the payslip they've been signing for years.`,
  peace: (served, where) =>
    `${served} people got a few hours at ${where} that belonged to them today — to stretch, to breathe, to be somewhere that wasn't a worksite or a dormitory.`,
  default: (served, where) =>
    `${served} migrant workers were served at ${where} today because it happened at all.`,
};

// Closing lines, same idea — carry the feeling without an ask attached.
const IMPACT_CLOSERS = {
  items: "Most of them are thousands of miles from everyone they love, and are used to being looked past. Today someone handed them something and met their eye.",
  knowledge:
    "They work six days a week and came to learn on the seventh. Somebody had to be there to teach them. That was you.",
  peace:
    "They spend their days being useful to other people. For a few hours today, someone made space for them to just be.",
  default:
    "They spend most of their lives being looked past. Today somebody showed up for them.",
};

/**
 * The post-event thank-you.
 *
 * Deliberately has no ask in it — no points, no tier, no next event, no reply
 * keyword. Every other message this system sends wants something from the
 * volunteer. This one is the only one that doesn't, and that's what makes it
 * worth sending.
 *
 * The numbers come from lib/impact.js and are display values, not measurements
 * — see the warning at the top of that file.
 */
export function formatImpactMessage(event, impact, name) {
  const kind = IMPACT_LINES[impact.profile] ? impact.profile : "default";
  // Events are often named with a trailing date to tell repeats apart. That's
  // useful in a list and clumsy in a sentence — "came through GIFTIK Drive —
  // 2027-02-04 today" — so drop it here only.
  const label = String(event?.name || "").replace(/\s*[—–-]\s*\d{4}-\d{2}-\d{2}\s*$/, "");
  const where = label ? `*${label}*` : "our doors";
  // First name only — the full name off a form reads like a letter from a bank.
  const who = String(name || "").trim().split(/\s+/)[0];

  return [
    who ? `${who} — thank you for today. 🙏` : "Thank you for today. 🙏",

    IMPACT_LINES[kind](impact.served, where),

    `You were one of ${impact.volunteers} volunteers who made that happen — around ${impact.perVolunteer} people served because you gave up your day.`,

    IMPACT_CLOSERS[kind],

    "Thank you.\n— Passion To Serve",
  ].join("\n\n");
}

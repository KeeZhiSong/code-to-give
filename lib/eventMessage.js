// Every word a volunteer reads on WhatsApp is built here.
//
// One formatter, three callers — the invite (app/api/send), the RSVP
// confirmation (lib/handleWebhook), and reminders when they exist. Writing the
// copy once is the point: three copies drift, and the volunteer is the one who
// notices when the invite and the confirmation disagree about the venue.
//
// Every field is optional. A blank one drops its line rather than printing an
// empty label, so a half-filled event still produces a sensible message.

/** Keywords a volunteer can text in to check their standing. */
export const POINTS_KEYWORDS = /^\s*(points?|my ?points?|balance|loyalty|tier|vip)\s*[?.!]*\s*$/i;

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

/**
 * The details block: what this is, when, where, what to wear and bring.
 * Returns "" when the event carries nothing worth saying.
 */
export function formatEventDetails(event) {
  if (!event) return "";

  const lines = [`📍 *${event.name}*`];

  const when = formatWhen(event.starts_at, event.ends_at);
  if (when) lines.push(`🗓 ${when}`);

  const where = formatWhere(event);
  if (where) lines.push(`📌 ${where}`);

  if (event.dress_code?.trim()) lines.push(`👕 ${event.dress_code.trim()}`);
  if (event.what_to_bring?.trim()) lines.push(`🎒 ${event.what_to_bring.trim()}`);

  // The description is prose, so it gets its own paragraph rather than a
  // pictogram line.
  const body = event.description?.trim();
  return body ? `${lines.join("\n")}\n\n${body}` : lines.join("\n");
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

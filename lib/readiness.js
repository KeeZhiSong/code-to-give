// Event Readiness Score — one number from three inputs that already exist
// elsewhere in the app: confirmed headcount vs. target, task-board
// completion, and logistics-partner confirmation. Recomputed on every read,
// never stored, so it can never drift from the records it's built from.
//
// Each input defaults to "satisfied" (ratio 1) when there's nothing to
// measure — an event with no capacity set, no tasks yet, or no partners
// logged shouldn't be marked down for a dimension nobody's using. This
// mirrors the same call the headcount dashboard already makes for a
// capacity-less event.

import { getEventHeadcount, getRespondedPhones } from "./headcount.js";
import { listTasks } from "./tasks.js";
import { listPartners } from "./partners.js";
import { listVolunteers } from "./volunteers.js";

const READY_THRESHOLD = 80;

function clampRatio(n) {
  return Math.max(0, Math.min(1, n));
}

export async function getEventReadiness(eventId) {
  const [headcount, tasks, partners] = await Promise.all([
    getEventHeadcount(eventId),
    listTasks(eventId),
    listPartners(eventId),
  ]);
  if (!headcount) return null;

  const { volunteers } = headcount;
  // A target of 0 divides to NaN, which then poisons the whole score — treat
  // "no target set" and "target of zero" the same: nothing to measure.
  const volunteerRatio = !volunteers.target
    ? 1
    : clampRatio(volunteers.confirmed / volunteers.target);

  const doneTasks = tasks.filter((t) => t.status === "done");
  const taskRatio = tasks.length === 0 ? 1 : doneTasks.length / tasks.length;

  const confirmedPartners = partners.filter((p) => p.confirmed);
  const partnerRatio = partners.length === 0 ? 1 : confirmedPartners.length / partners.length;

  const score = Math.round(((volunteerRatio + taskRatio + partnerRatio) / 3) * 100);
  const label = score >= READY_THRESHOLD ? "on-track" : "needs-attention";

  const suggestions = [];

  if (volunteerRatio < 1) {
    const shortBy = volunteers.target - volunteers.confirmed;
    // Anyone who's attended a past event and hasn't already responded (yes or
    // no) to this one is a candidate to re-invite — a lightweight read of the
    // loyalty ledger migration 003 added, not a new list of its own.
    const [allVolunteers, responded] = await Promise.all([
      listVolunteers(),
      getRespondedPhones(eventId),
    ]);
    const candidates = allVolunteers.filter(
      (v) => v.eventsAttended.length > 0 && !responded.has(v.phone)
    );
    const picked = shortBy > 0 ? candidates.slice(0, shortBy) : candidates;

    if (picked.length > 0) {
      suggestions.push({
        type: "volunteers",
        text: `Re-invite ${picked.length} past volunteer${picked.length === 1 ? "" : "s"} — ${shortBy} short of target.`,
        recipients: picked.map((v) => ({ phone: v.phone, name: v.name })),
      });
    } else {
      suggestions.push({ type: "volunteers", text: `${shortBy} more volunteers needed to hit target.` });
    }
  }

  if (taskRatio < 1) {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = tasks.filter((t) => t.status !== "done" && t.deadline && t.deadline < today);
    if (overdue.length > 0) {
      const byOwner = new Map();
      for (const t of overdue) {
        const owner = t.owner || "unassigned";
        byOwner.set(owner, (byOwner.get(owner) || 0) + 1);
      }
      const [topOwner] = [...byOwner.entries()].sort((a, b) => b[1] - a[1]);
      suggestions.push({
        type: "tasks",
        text: `${overdue.length} task${overdue.length === 1 ? "" : "s"} overdue — nudge ${topOwner[0]}.`,
      });
    } else {
      const outstanding = tasks.length - doneTasks.length;
      suggestions.push({
        type: "tasks",
        text: `${outstanding} task${outstanding === 1 ? "" : "s"} still outstanding on the board.`,
      });
    }
  }

  if (partnerRatio < 1) {
    const unconfirmed = partners.filter((p) => !p.confirmed);
    suggestions.push({
      type: "partners",
      text: `Confirm with ${unconfirmed.map((p) => p.name).join(", ")}.`,
    });
  }

  return {
    eventId,
    score,
    label,
    breakdown: {
      volunteers: Math.round(volunteerRatio * 100),
      tasks: Math.round(taskRatio * 100),
      partners: Math.round(partnerRatio * 100),
    },
    suggestions,
  };
}

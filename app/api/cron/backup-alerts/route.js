import { NextResponse } from "next/server";
import { listEvents } from "../../../../lib/events.js";
import {
  getEventHeadcount,
  getRespondedPhones,
} from "../../../../lib/headcount.js";
import { listVolunteers } from "../../../../lib/volunteers.js";
import { sendPollBroadcast } from "../../../../lib/broadcast.js";
import { CRON_SECRET, BACKUP_ALERT_DAYS_OUT } from "../../../../lib/config.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Vercel Cron (see vercel.json) hits this daily. Guarded by a shared secret —
// without this it would be another unauthenticated send endpoint.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await listEvents();
  const now = Date.now();
  const windowEnd = now + BACKUP_ALERT_DAYS_OUT * MS_PER_DAY;

  const dueEvents = events.filter((e) => {
    if (e.status !== "open" || !e.starts_at) return false;
    const startsAt = new Date(e.starts_at).getTime();
    return startsAt >= now && startsAt <= windowEnd;
  });

  let alertsSent = 0;

  for (const event of dueEvents) {
    const headcount = await getEventHeadcount(event.id);
    if (!headcount?.volunteers.target) continue;
    if (headcount.volunteers.confirmed >= headcount.volunteers.target) continue;

    const respondedPhones = await getRespondedPhones(event.id);
    const volunteers = await listVolunteers();
    const backups = volunteers.filter(
      (v) => v.isBackup && !respondedPhones.has(v.phone),
    );
    if (!backups.length) continue;

    const shortfall =
      headcount.volunteers.target - headcount.volunteers.confirmed;
    const poll = {
      id: event.id,
      campaign: event.name,
      question: `${event.name} is short ${shortfall} volunteer${shortfall === 1 ? "" : "s"} and coming up soon — can you make it?`,
      options: ["Yes, I'm in", "Can't make it"],
    };
    const results = await sendPollBroadcast(backups, poll, {
      intent: "backup",
    });
    alertsSent += results.filter((r) => r.status === "sent").length;
  }

  return NextResponse.json({ eventsChecked: dueEvents.length, alertsSent });
}

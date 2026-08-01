import { NextResponse } from "next/server";
import { createEvent, EventError } from "../../../../lib/events.js";
import { createTask } from "../../../../lib/tasks.js";
import { createPartner } from "../../../../lib/partners.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Event Templates & Duplication.
//
// A template is a checklist an organiser has already got right once: the tasks,
// the logistics partners, the roles. Cloning it must produce a REAL event with
// that checklist already on its board — otherwise "duplicate" just means
// retyping the same eight tasks into a fresh event.

const PILLAR_FROM_CATEGORY = {
  "Items To Serve (R3)": "Items To Serve",
  "Knowledge To Serve": "Knowledge To Serve",
  "Peace To Serve": "Peace To Serve",
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const {
    templateName,
    category,
    date,
    venue,
    tasks = [],
    partners = [],
    // The template's volunteer-facing copy — what the event is, what to wear,
    // what to bring, where to gather. Without this a cloned event sends a bare
    // poll, and the organiser retypes the same briefing every time.
    details = {},
  } = body;

  if (!templateName || !date || !venue) {
    return NextResponse.json(
      { error: "templateName, date and venue are required." },
      { status: 400 }
    );
  }

  try {
    // Event names are unique — they're the campaign key — so a second clone of
    // the same template on the same date needs distinguishing rather than
    // failing with a constraint error the organiser can't act on.
    const base = `${templateName} — ${date}`;
    let event;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const name = attempt === 0 ? base : `${base} (${attempt + 1})`;
      try {
        event = await createEvent({
          name,
          venue,
          starts_at: `${date}T09:00`,
          pillar: PILLAR_FROM_CATEGORY[category] || null,
          question: `Join ${templateName} on ${date}?`,
          status: "open",
          description: details.description || null,
          dress_code: details.dress_code || null,
          what_to_bring: details.what_to_bring || null,
          meeting_point: details.meeting_point || null,
        });
        break;
      } catch (e) {
        if (e instanceof EventError && /already exists/.test(e.message)) continue;
        throw e;
      }
    }
    if (!event) {
      return NextResponse.json(
        { error: "Couldn't find a free name for this clone. Rename the template." },
        { status: 409 }
      );
    }

    // Best-effort: the event exists and is usable even if a checklist row
    // fails, so report what landed rather than rolling the whole thing back.
    let taskCount = 0;
    for (const title of tasks) {
      try {
        await createTask(event.id, { title });
        taskCount += 1;
      } catch {
        /* skip */
      }
    }

    let partnerCount = 0;
    for (const name of partners) {
      try {
        await createPartner(event.id, { name });
        partnerCount += 1;
      } catch {
        /* skip */
      }
    }

    return NextResponse.json({ event, taskCount, partnerCount }, { status: 201 });
  } catch (e) {
    const status = e instanceof EventError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

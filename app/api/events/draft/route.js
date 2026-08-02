import { NextResponse } from "next/server";
import { draftEvent, eventDraftConfigured } from "../../../../lib/eventDraft.js";

export const dynamic = "force-dynamic";
// The model gets 12s; this is the outer bound so the request always answers.
export const maxDuration = 30;

/**
 * POST { text } — draft an event from a line of shorthand.
 *
 * Returns form values only. It does NOT create the event: the organiser
 * reviews and saves through the normal path, so nothing a model invented
 * reaches a volunteer without a human having looked at it.
 */
export async function POST(request) {
  try {
    if (!eventDraftConfigured()) {
      return NextResponse.json(
        { error: "AI drafting isn't configured on this deployment." },
        { status: 503 }
      );
    }

    const { text } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Describe the event first." }, { status: 400 });
    }

    const draft = await draftEvent(text);
    if (!draft) {
      // Unconfigured, failed or too slow — all the same to the organiser, who
      // just needs to know the form is theirs to fill in.
      return NextResponse.json(
        { error: "Couldn't draft that one — fill the form in directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { markEventAttended } from "../../../../../lib/volunteers.js";

export const dynamic = "force-dynamic";

// Marks a volunteer as having attended an event — organiser-driven, from the
// Roster, after the event. Feeds the loyalty ledger that the Readiness
// Score's "re-invite past volunteers" suggestion reads from.
export async function POST(request, { params }) {
  const { phone } = await params;
  try {
    const { eventName } = await request.json();
    if (!eventName) {
      return NextResponse.json({ error: "eventName is required." }, { status: 400 });
    }
    const result = await markEventAttended(phone, eventName);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

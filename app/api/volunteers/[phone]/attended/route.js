import { NextResponse } from "next/server";
import { markEventAttended } from "../../../../../lib/volunteers.js";

export const dynamic = "force-dynamic";

// Marks a volunteer OR beneficiary as having attended an event —
// organiser-driven, from the Roster, after the event.
//
// The single attendance writer: it feeds both events_attended (which the
// Readiness Score's "re-invite past volunteers" reads) and the points ledger
// behind the Loyalty Programme and the beneficiary VIP Pass.
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

import { NextResponse } from "next/server";
import { setAttendance } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

/**
 * POST { phone, campaign, attended: boolean }
 * Marks someone present on the day. Flips registrations.status between
 * "registered" and "attended", which is what builds a volunteer's history.
 */
export async function POST(request) {
  try {
    const { phone, campaign, attended } = await request.json();
    if (!phone || !campaign) {
      return NextResponse.json(
        { error: "phone and campaign are required." },
        { status: 400 }
      );
    }
    await setAttendance({ phone, campaign, attended: Boolean(attended) });
    return NextResponse.json({ ok: true, phone, attended: Boolean(attended) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { setBackupFlag } from "../../../../../lib/volunteers.js";

export const dynamic = "force-dynamic";

// Toggles whether a volunteer is a standby who can be messaged by the
// backup-volunteer alert cron — organiser-driven, from the console.
export async function PATCH(request, { params }) {
  const { phone } = await params;
  try {
    const { isBackup } = await request.json();
    const volunteer = await setBackupFlag(phone, isBackup);
    return NextResponse.json(volunteer);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

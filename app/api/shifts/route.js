import { NextResponse } from "next/server";
import { listShifts } from "../../../lib/shifts.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ shifts: await listShifts() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

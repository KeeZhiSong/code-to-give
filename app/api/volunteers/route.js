import { NextResponse } from "next/server";
import { getVolunteers, sourceLabel } from "../../../lib/sheets.js";
import { getOptOuts } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [volunteers, optOuts] = await Promise.all([getVolunteers(), getOptOuts()]);
    return NextResponse.json({
      source: sourceLabel(),
      volunteers: volunteers.map((v) => ({ ...v, optedOut: optOuts.includes(v.phone) })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

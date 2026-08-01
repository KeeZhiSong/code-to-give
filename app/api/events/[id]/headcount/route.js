import { NextResponse } from "next/server";
import { getEventHeadcount } from "../../../../../lib/headcount.js";

// Backs both the organiser console and the public /share/[id] page — the
// latter has no auth, so this route must never return anything beyond
// aggregate counts (no names, no phone numbers).
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const headcount = await getEventHeadcount(id);
    if (!headcount) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json(headcount);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

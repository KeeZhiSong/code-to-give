import { NextResponse } from "next/server";
import { getEventReadiness } from "../../../../../lib/readiness.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const readiness = await getEventReadiness(id);
    if (!readiness) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json(readiness);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

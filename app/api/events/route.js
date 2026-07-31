import { NextResponse } from "next/server";
import { listEvents, createEvent, EventError } from "../../../lib/events.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ events: await listEvents() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const event = await createEvent(await request.json());
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    // A validation failure is the caller's fault, not a server fault.
    const status = e instanceof EventError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

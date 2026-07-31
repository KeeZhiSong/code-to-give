import { NextResponse } from "next/server";
import { updateEvent, deleteEvent, EventError } from "../../../../lib/events.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const event = await updateEvent(id, await request.json());
    return NextResponse.json({ event });
  } catch (e) {
    const status = e instanceof EventError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  try {
    // Registrations cascade — deleting an event deletes its roster too.
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof EventError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

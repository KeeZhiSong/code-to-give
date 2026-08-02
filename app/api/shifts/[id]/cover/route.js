import { NextResponse } from "next/server";
import { coverShift } from "../../../../../lib/shifts.js";

export const dynamic = "force-dynamic";

/**
 * POST — the primary volunteer has dropped out; promote the first standby.
 *
 * Takes no body on purpose. Who covers the shift is read from the standby
 * queue server-side, so the browser can't nominate a replacement of its own
 * choosing.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    return NextResponse.json(await coverShift(id));
  } catch (e) {
    const status = /not found/i.test(e.message) ? 404 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

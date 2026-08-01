import { NextResponse } from "next/server";
import { addOptOut, removeOptOut } from "../../../lib/store.js";

export const dynamic = "force-dynamic";

/**
 * POST { phone, optedOut: boolean }
 *
 * Lets an organiser act on a request made in person — "put me back on the
 * list" said at a drive never reaches the WhatsApp keyword. Opting someone
 * back IN is the point; opting them out from here exists so the control is
 * reversible rather than a trapdoor in the other direction.
 */
export async function POST(request) {
  try {
    const { phone, optedOut } = await request.json();
    if (!phone) {
      return NextResponse.json({ error: "phone is required." }, { status: 400 });
    }
    if (optedOut) await addOptOut(phone);
    else await removeOptOut(phone);
    return NextResponse.json({ ok: true, phone, optedOut: Boolean(optedOut) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

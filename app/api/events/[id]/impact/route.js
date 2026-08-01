import { NextResponse } from "next/server";
import { checkWhatsApp, sendText, toChatId } from "../../../../../lib/greenapi.js";
import { getOptOuts } from "../../../../../lib/store.js";
import { getEvent } from "../../../../../lib/events.js";
import { formatImpactMessage } from "../../../../../lib/eventMessage.js";
import { getEventImpact } from "../../../../../lib/impact.js";
import { assertConfigured } from "../../../../../lib/config.js";

export const dynamic = "force-dynamic";

/**
 * POST { phone, name? } — send one volunteer the post-event thank-you.
 *
 * Sent per person from the roster rather than in a batch: it goes out after
 * the event, to people the organiser has just confirmed actually turned up,
 * and the organiser is the one who decides that one by one.
 *
 * Honours opt-outs. Someone who sent STOP has said they don't want messages
 * from us, and a warm one is still one.
 */
export async function POST(request, { params }) {
  try {
    assertConfigured();
    const { id } = await params;
    const { phone, name = "" } = await request.json();

    const digits = String(phone || "").replace(/[^\d]/g, "");
    if (!digits) {
      return NextResponse.json({ error: "phone is required." }, { status: 400 });
    }

    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    if ((await getOptOuts()).includes(digits)) {
      return NextResponse.json(
        { error: "This person has opted out of messages." },
        { status: 409 }
      );
    }

    // checkWhatsApp throws on a malformed number rather than returning false.
    // Either way the answer is the same — we can't reach them — and an
    // organiser shouldn't be shown a raw gateway error to work that out.
    let reachable = false;
    try {
      reachable = await checkWhatsApp(digits);
    } catch {
      reachable = false;
    }
    if (!reachable) {
      return NextResponse.json(
        { error: "That number isn't reachable on WhatsApp." },
        { status: 422 }
      );
    }

    const impact = getEventImpact(event);
    const message = formatImpactMessage(event, impact, name);
    await sendText(toChatId(digits), message);

    return NextResponse.json({ ok: true, impact });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

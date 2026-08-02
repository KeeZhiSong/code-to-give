import { NextResponse } from "next/server";
import { checkWhatsApp, sendText, toChatId } from "../../../../../lib/greenapi.js";
import { getOptOuts } from "../../../../../lib/store.js";
import { getEvent } from "../../../../../lib/events.js";
import { formatImpactMessage } from "../../../../../lib/eventMessage.js";
import { getEventImpact } from "../../../../../lib/impact.js";
import { assertConfigured, SEND_DELAY_MS } from "../../../../../lib/config.js";

export const dynamic = "force-dynamic";

/**
 * POST { phone, name? }  or  { recipients: [{ phone, name }] }
 *
 * The post-event thank-you: what a volunteer's hours actually amounted to.
 *
 * The batch form exists because thanking twelve people one click at a time is
 * the kind of chore that quietly doesn't happen. It fans out HERE rather than
 * from the browser: sends have to be sequential with a gap between them or the
 * unofficial WhatsApp number gets blocked, and a page firing twelve parallel
 * fetches would do exactly what we spent the whole build avoiding.
 *
 * Honours opt-outs. Someone who sent STOP has said they don't want messages
 * from us, and a warm one is still one.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Vercel kills the function at maxDuration; at ~1.5s a send plus the
// reachability check, this is what comfortably fits. A roster bigger than this
// is a scale problem the official API solves, not one to solve by sending
// faster.
const MAX_PER_BATCH = 25;

export async function POST(request, { params }) {
  try {
    assertConfigured();
    const { id } = await params;
    const body = await request.json();

    // One recipient or many — the single form is what the per-row button uses.
    const list = Array.isArray(body.recipients)
      ? body.recipients
      : [{ phone: body.phone, name: body.name || "" }];

    const cleaned = list
      .map((r) => ({
        phone: String(r?.phone || "").replace(/[^\d]/g, ""),
        name: r?.name || "",
      }))
      .filter((r) => r.phone);

    if (cleaned.length === 0) {
      return NextResponse.json({ error: "No recipients." }, { status: 400 });
    }
    if (cleaned.length > MAX_PER_BATCH) {
      return NextResponse.json(
        { error: `Too many at once — ${MAX_PER_BATCH} is the cap.` },
        { status: 400 }
      );
    }

    const event = await getEvent(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    // Computed once: it's the same event for all of them, and the figures must
    // not differ between two people comparing phones.
    const impact = getEventImpact(event);
    const optOuts = await getOptOuts();
    const results = [];

    for (const [i, r] of cleaned.entries()) {
      if (optOuts.includes(r.phone)) {
        results.push({ ...r, status: "skipped", reason: "opted out" });
        continue;
      }

      // checkWhatsApp throws on a malformed number rather than returning
      // false. Either way the answer is the same — we can't reach them — and
      // an organiser shouldn't be shown a raw gateway error to work that out.
      let reachable = false;
      try {
        reachable = await checkWhatsApp(r.phone);
      } catch {
        reachable = false;
      }
      if (!reachable) {
        results.push({ ...r, status: "failed", reason: "not on WhatsApp" });
        continue;
      }

      try {
        await sendText(toChatId(r.phone), formatImpactMessage(event, impact, r.name));
        results.push({ ...r, status: "sent" });
      } catch (e) {
        results.push({ ...r, status: "failed", reason: e.message });
      }

      // Never parallelise this. The gap is the whole reason the number
      // survives a roster-sized send.
      if (i < cleaned.length - 1) await sleep(SEND_DELAY_MS);
    }

    const sent = results.filter((r) => r.status === "sent").length;

    // A single-recipient call keeps its old shape so the per-row button and
    // its error handling don't have to change.
    if (!Array.isArray(body.recipients)) {
      const only = results[0];
      if (only.status !== "sent") {
        const status = only.reason === "opted out" ? 409 : 422;
        return NextResponse.json({ error: reasonText(only) }, { status });
      }
      return NextResponse.json({ ok: true, impact });
    }

    return NextResponse.json({ ok: true, sent, total: cleaned.length, results, impact });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function reasonText(r) {
  if (r.reason === "opted out") return "This person has opted out of messages.";
  if (r.reason === "not on WhatsApp") return "That number isn't reachable on WhatsApp.";
  return r.reason || "Couldn't send.";
}

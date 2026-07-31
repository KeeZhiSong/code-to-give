import { NextResponse } from "next/server";
import { checkWhatsApp, sendPoll, sendText, toChatId } from "../../../lib/greenapi.js";
import { getOptOuts } from "../../../lib/store.js";
import { EVENT, SEND_DELAY_MS, assertConfigured } from "../../../lib/config.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: sends are sequential and deliberately slow

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST { mode: "poll" | "text", recipients: [{name, phone}], message? }
 * Sends one at a time with a delay — ban-safety. Never parallelise this.
 */
export async function POST(request) {
  try {
    assertConfigured();
    const { mode = "poll", recipients = [], message = "" } = await request.json();

    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients selected." }, { status: 400 });
    }
    if (mode === "text" && !message.trim()) {
      return NextResponse.json({ error: "Message is empty." }, { status: 400 });
    }

    const optOuts = await getOptOuts();
    const results = [];

    for (const r of recipients) {
      const phone = String(r.phone).replace(/[^\d]/g, "");

      if (optOuts.includes(phone)) {
        results.push({ ...r, status: "skipped", reason: "opted out" });
        continue;
      }

      try {
        if (!(await checkWhatsApp(phone))) {
          results.push({ ...r, status: "failed", reason: "not on WhatsApp" });
          continue;
        }

        const chatId = toChatId(phone);
        if (mode === "poll") {
          await sendPoll(chatId, EVENT);
        } else {
          // {name} merge — first name only, falls back to a neutral greeting.
          const firstName = (r.name || "").trim().split(/\s+/)[0] || "there";
          await sendText(chatId, message.replaceAll("{name}", firstName));
        }
        results.push({ ...r, status: "sent" });
      } catch (e) {
        results.push({ ...r, status: "failed", reason: e.message });
      }

      await sleep(SEND_DELAY_MS);
    }

    return NextResponse.json({
      mode,
      campaign: EVENT.campaign,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

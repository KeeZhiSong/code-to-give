import { NextResponse } from "next/server";
import { checkWhatsApp, sendPoll, sendText, toChatId } from "../../../lib/greenapi.js";
import { getOptOuts } from "../../../lib/store.js";
import { getEvent, recordPollPrompt } from "../../../lib/events.js";
import { formatEventDetails } from "../../../lib/eventMessage.js";
import { EVENT, SEND_DELAY_MS, assertConfigured } from "../../../lib/config.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: sends are sequential and deliberately slow

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * POST { mode, recipients, message?, eventId?, includeDetails? }
 * Sends one at a time with a delay — ban-safety. Never parallelise this.
 *
 * `includeDetails` sends the event's details as a text message immediately
 * before the poll, so a volunteer isn't asked to commit to a Sunday without
 * knowing the date, the venue, or what to bring. It doubles the message count,
 * which is why it's a per-send choice rather than always on.
 */
export async function POST(request) {
  try {
    assertConfigured();
    const {
      mode = "poll",
      recipients = [],
      message = "",
      eventId = null,
      includeDetails = false,
    } = await request.json();

    if (!recipients.length) {
      return NextResponse.json({ error: "No recipients selected." }, { status: 400 });
    }
    if (mode === "text" && !message.trim()) {
      return NextResponse.json({ error: "Message is empty." }, { status: 400 });
    }

    // The poll question and campaign come from the chosen event. Without one
    // (no Supabase, or an older client) fall back to the single config event.
    const selected = eventId ? await getEvent(eventId) : null;
    const poll = selected
      ? { campaign: selected.name, question: selected.question, options: EVENT.options }
      : EVENT;

    // Built once, sent to everyone — it's the same event for all of them.
    const detailsText =
      mode === "poll" && includeDetails && selected
        ? formatEventDetails(selected)
        : "";

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
          // Details first so the poll lands last — it's the thing they act on,
          // and it should be at the bottom of the chat. A failed details
          // message must not cost them the invite, so it's best-effort.
          if (detailsText) {
            try {
              await sendText(chatId, detailsText);
              await sleep(SEND_DELAY_MS);
            } catch {
              /* the poll below still goes out */
            }
          }
          const res = await sendPoll(chatId, poll);
          // Remember which event this poll was for. Votes come back carrying
          // the same id as pollMessageData.stanzaId, so the webhook can resolve
          // the event directly instead of matching on question text.
          if (selected?.id && res?.idMessage) {
            await recordPollPrompt({ stanzaId: res.idMessage, eventId: selected.id });
          }
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
      campaign: poll.campaign,
      sent: results.filter((r) => r.status === "sent").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

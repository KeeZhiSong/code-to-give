import { NextResponse } from "next/server";
import { handleWebhook } from "../../../lib/handleWebhook.js";

export const dynamic = "force-dynamic";

/**
 * Vercel path: GreenAPI POSTs notifications straight here.
 *
 * NOT USED LOCALLY — scripts/listen.js polls instead. The two are mutually
 * exclusive: the moment you set webhookUrl in the GreenAPI console, messages
 * stop landing in the polling queue.
 *
 * To switch on after deploying:
 *   set webhookUrl = https://<your-app>.vercel.app/api/webhook
 *
 * Always answer 200 quickly — GreenAPI retries anything else, and a retry storm
 * would resend confirmations to volunteers.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    await handleWebhook(body);
  } catch (e) {
    console.error("webhook error:", e.message);
  }
  return NextResponse.json({ ok: true });
}

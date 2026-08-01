// GreenAPI client. Lifted from the proven whatsapp-rsvp.js CLI.
// Zero dependencies — Node 18+ has fetch built in.

import { GREENAPI, EVENT } from "./config.js";

// URL shape is always:  {apiUrl}/waInstance{id}/{method}/{token}[/{extra}]
// The token is ALWAYS the last segment before any extra path parts — getting
// this backwards returns a bare 401 with an empty body.
function endpoint(method, extra = "") {
  const tail = extra ? `/${extra}` : "";
  return `${GREENAPI.apiUrl}/waInstance${GREENAPI.idInstance}/${method}/${GREENAPI.apiToken}${tail}`;
}

async function callApi(method, body, httpMethod = "POST") {
  const opts = { method: httpMethod, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(endpoint(method), opts);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} failed: HTTP ${res.status} ${text || "(empty body)"}`);
  }
  return text ? JSON.parse(text) : null;
}

// Normalize a bare number ("+65 9123 4567") into a chatId ("6591234567@c.us")
export function toChatId(number) {
  if (String(number).includes("@")) return number;
  return String(number).replace(/[^\d]/g, "") + "@c.us";
}

export function toDigits(number) {
  return String(number).replace(/[^\d]/g, "");
}

export async function checkWhatsApp(number) {
  const res = await callApi("checkWhatsapp", { phoneNumber: Number(toDigits(number)) });
  return res && res.existsWhatsapp;
}

export async function sendPoll(chatId, event = EVENT) {
  return callApi("sendPoll", {
    chatId,
    message: event.question,
    options: event.options.map((o) => ({ optionName: o })),
    multipleAnswers: false,
  });
}

export async function sendText(chatId, message) {
  return callApi("sendMessage", { chatId, message });
}

// Fixed, non-instance host GreenAPI recommends for uploads — unlike every
// other call here, this does NOT use GREENAPI.apiUrl. Confirmed against
// GreenAPI's docs 2026-08-01: "For the SendFileByUpload method, we recommend
// to use the media.green-api.com host."
const MEDIA_URL = "https://media.green-api.com";

/**
 * Send an image (or any file) with an optional caption, in one WhatsApp
 * message — used for the VIP Pass / volunteer milestone poster (lib/poster.jsx).
 *
 * Deliberately NOT sendFileByUrl: that variant needs the file hosted at a
 * public URL first, which would mean standing up storage just to send an
 * image we already have the bytes for. sendFileByUpload posts the bytes
 * directly, so it works the same in local dev as it does deployed.
 */
export async function sendImage(chatId, { buffer, fileName, caption }) {
  const form = new FormData();
  form.append("chatId", chatId);
  if (caption) form.append("caption", caption);
  form.append("file", new Blob([buffer], { type: "image/png" }), fileName);

  const url = `${MEDIA_URL}/waInstance${GREENAPI.idInstance}/sendFileByUpload/${GREENAPI.apiToken}`;
  const res = await fetch(url, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`sendFileByUpload failed: HTTP ${res.status} ${text || "(empty body)"}`);
  }
  return text ? JSON.parse(text) : null;
}

export async function getStateInstance() {
  return callApi("getStateInstance", null, "GET");
}

export async function getSettings() {
  return callApi("getSettings", null, "GET");
}

// ─── Polling transport (local dev / demo only) ───────────────────────────────
// On Vercel these are unused — the webhook route receives pushes instead.

export async function receiveNotification() {
  // Long-polls ~5s. Returns { receiptId, body }, or null when nothing is waiting
  // (GreenAPI answers 200 with a literal `null` body in that case).
  const res = await fetch(endpoint("receiveNotification"), { method: "GET" });
  if (res.status !== 200) return null;
  const text = await res.text();
  if (!text || text === "null") return null;
  const data = JSON.parse(text);
  return data && data.receiptId ? data : null;
}

export async function deleteNotification(receiptId) {
  // receiptId goes AFTER the token: .../deleteNotification/{token}/{receiptId}
  const res = await fetch(endpoint("deleteNotification", receiptId), { method: "DELETE" });
  if (!res.ok) {
    // Must not fail silently: an undeleted notification is handed back forever,
    // which wedges the listener on one message and looks like a dead script.
    throw new Error(`deleteNotification(${receiptId}) failed: HTTP ${res.status}`);
  }
}

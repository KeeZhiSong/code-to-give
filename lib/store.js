// Response store — the roster.
//
// This module is the ONLY place that knows how responses are persisted.
// It picks a backend at call time:
//
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set  →  Supabase (deployed)
//   otherwise                                     →  local JSON files (dev)
//
// The fallback is what keeps `npm run dev` working with no credentials. It is
// NOT viable on Vercel: that filesystem is ephemeral and read-only outside the
// temp dir, so writes appear to succeed and then vanish. Deployed = Supabase.
//
// NOTE: the JSON path is not safe for concurrent writers. Fine locally — one
// Next server plus one listener, both low-volume.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import * as supa from "./supabaseStore.js";

const useSupabase = () => supa.supabaseConfigured();

/** Which backend is live — surfaced in the UI so the source is never a guess. */
export function storeLabel() {
  return useSupabase() ? "Supabase" : "local JSON (dev only)";
}

const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "responses.json");

async function readAll() {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(rows) {
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(rows, null, 2));
}

// One response per (phone, campaign) — a changed vote overwrites the old one.
// eventId is optional — when a caller already knows it exactly (see
// lib/events.js's eventForStanza), passing it lets the Supabase backend skip
// its name-based lookup, which can otherwise create a duplicate event row.
export async function recordResponse({
  phone,
  name,
  answer,
  campaign,
  raw,
  eventId,
}) {
  if (useSupabase()) {
    return supa.recordResponse({ phone, name, answer, campaign, raw, eventId });
  }
  const rows = await readAll();
  const idx = rows.findIndex(
    (r) => r.phone === phone && r.campaign === campaign,
  );
  const entry = {
    phone,
    name: name || phone,
    answer, // "yes" | "no"
    campaign,
    raw: raw || "",
    at: new Date().toISOString(),
  };
  if (idx === -1) rows.push(entry);
  else rows[idx] = entry;
  await writeAll(rows);
  return entry;
}

// A retracted vote removes them from the roster entirely.
export async function clearResponse({ phone, campaign, eventId }) {
  if (useSupabase()) return supa.clearResponse({ phone, campaign, eventId });
  const rows = await readAll();
  const next = rows.filter(
    (r) => !(r.phone === phone && r.campaign === campaign),
  );
  if (next.length !== rows.length) await writeAll(next);
}

export async function getResponses(campaign, eventId) {
  if (useSupabase()) return supa.getResponses(campaign, eventId);
  const rows = await readAll();
  return campaign ? rows.filter((r) => r.campaign === campaign) : rows;
}

export async function getRoster(campaign) {
  const rows = await getResponses(campaign);
  return {
    going: rows.filter((r) => r.answer === "yes"),
    notGoing: rows.filter((r) => r.answer === "no"),
    total: rows.length,
  };
}

// ─── Opt-outs (PDPA: "reply STOP anytime") ───────────────────────────────────
const OPTOUT_FILE = path.join(DIR, "optouts.json");

export async function getOptOuts() {
  if (useSupabase()) return supa.getOptOuts();
  try {
    return JSON.parse(await readFile(OPTOUT_FILE, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

export async function addOptOut(phone) {
  if (useSupabase()) return supa.addOptOut(phone);
  const list = await getOptOuts();
  if (!list.includes(phone)) {
    list.push(phone);
    await mkdir(DIR, { recursive: true });
    await writeFile(OPTOUT_FILE, JSON.stringify(list, null, 2));
  }
}

/**
 * Let someone back onto the list.
 *
 * Withdrawing consent has to be honoured; it doesn't have to be permanent.
 * Without this a mistyped STOP, a shared phone, or a change of heart next
 * month locked a volunteer out of the programme for good.
 */
export async function removeOptOut(phone) {
  if (useSupabase()) return supa.removeOptOut(phone);
  const list = await getOptOuts();
  const next = list.filter((p) => p !== phone);
  if (next.length !== list.length) {
    await mkdir(DIR, { recursive: true });
    await writeFile(OPTOUT_FILE, JSON.stringify(next, null, 2));
  }
}

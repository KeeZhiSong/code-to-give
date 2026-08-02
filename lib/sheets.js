// Contacts source. Name + phone only.
//
// Two modes, no credentials needed either way:
//   1. SHEET_CSV_URL set  → fetch the published Google Sheet as CSV.
//   2. otherwise          → read data/volunteers.json (seed data, works offline).
//
// To use a real Sheet: File → Share → Publish to web → pick the sheet → CSV,
// then put that URL in .env.local as SHEET_CSV_URL.
//
// NOTE: "Publish to web" makes the sheet readable by anyone with the link.
// Fine for seeded demo data; for real volunteer phone numbers, switch to a
// service account (google-spreadsheet / googleapis) before you go live.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { SHEET_CSV_URL, DEFAULT_COUNTRY_CODE, LOCAL_MOBILE } from "./config.js";

// "9123 4567" -> "6591234567". Numbers that already carry a country code, or
// that don't look like a local mobile, are passed through untouched.
//
// Everything non-numeric is stripped first, so spaces, dashes, brackets, a
// leading "+", and even a stray "hp:" or "(whatsapp)" all survive contact with
// a Google Form filled in on a phone.
export function normalizePhone(raw) {
  let digits = String(raw || "").replace(/[^\d]/g, "");

  // "00" is the international dialling prefix written out — 0065… means the
  // same thing as +65…, but stripping the "+" leaves the zeros behind and the
  // gateway rejects the result. Only collapse it when a country code actually
  // follows, so an 8-digit local number starting 00 (which isn't a thing here,
  // but costs nothing to be careful about) is left alone.
  if (digits.length > 10 && digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (DEFAULT_COUNTRY_CODE && LOCAL_MOBILE.test(digits)) {
    return DEFAULT_COUNTRY_CODE + digits;
  }
  return digits;
}

// Minimal CSV parser — handles quoted fields and embedded commas, which is
// all a name/phone sheet can realistically throw at us.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
// eslint-disable-next-line no-empty
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Find a column by fuzzy header match, so "Phone", "phone number",
// "WhatsApp Number" all work without the organiser renaming anything.
function findCol(headers, candidates) {
  const norm = headers.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  for (const cand of candidates) {
    const i = norm.findIndex((h) => h.includes(cand));
    if (i !== -1) return i;
  }
  return -1;
}

// Google Forms writes a checkbox answer as one cell joined with ", ".
// Split on comma-space so a label containing a comma survives intact.
function splitMulti(cell) {
  return String(cell || "")
    .split(/,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function rowsToVolunteers(rows) {
  if (!rows.length) return [];
  const [headers, ...body] = rows;
  const nameCol = findCol(headers, ["name"]);
  const phoneCol = findCol(headers, ["phone", "whatsapp", "contact", "number", "mobile"]);

  // Optional profile columns — the form grows over time, so every one of these
  // is allowed to be missing entirely, and blank for people who signed up
  // before the question existed. Neither case may drop them from the list.
  const typeCol = findCol(headers, ["iama", "iam"]);
  const pillarsCol = findCol(headers, ["pillar"]);
  const roleCol = findCol(headers, ["preferredrole", "role"]);

  if (phoneCol === -1) {
    throw new Error(
      `Couldn't find a phone column. Headers seen: ${headers.join(", ")}`
    );
  }

  const cell = (r, i) => (i === -1 ? "" : (r[i] || "").trim());

  return body
    .map((r) => {
      const rawPhone = (r[phoneCol] || "").trim();

      // Sheets exports a number-formatted cell as "6.58102E+09", which strips
      // down to a nonsense phone number. Catch it here rather than at send time.
      if (/e\+/i.test(rawPhone)) {
        throw new Error(
          `Phone "${rawPhone}" came through in scientific notation. Format the ` +
            `phone column as Plain text in the Sheet (Format → Number → Plain text), ` +
            `then re-enter the numbers.`
        );
      }

      return {
        name: cell(r, nameCol),
        phone: normalizePhone(rawPhone),
        type: cell(r, typeCol), // "Volunteer" | "Beneficiary" | "" (unanswered)
        pillars: splitMulti(cell(r, pillarsCol)),
        // Also a checkbox question — someone can prefer several roles, so this
        // splits like pillars. Keeping it a single string made the filter offer
        // one useless option ("Logistics, Teaching, Tech Support").
        roles: splitMulti(cell(r, roleCol)),
      };
    })
    .filter((v) => v.phone.length >= 8); // drop blanks / junk rows
}

/**
 * Read a published-CSV sheet into people.
 *
 * `url` defaults to SHEET_CSV_URL (the volunteer form). Pass a different one to
 * read a second form — beneficiaries get their own form and therefore their own
 * sheet, rather than being separated out of a shared one by a column.
 */
export async function getVolunteers(url = SHEET_CSV_URL) {
  if (url) {
    // `cache: "no-store"` only stops OUR caching. Google serves published CSVs
    // through its own CDN, which happily hands back a copy from before the
    // latest form response — observed live: this machine saw four signups while
    // the deployed function saw three, from the same URL at the same moment.
    // A changing query parameter makes it a URL the edge hasn't seen, so the
    // fetch reaches the real sheet.
    const fresh = `${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`;

    const res = await fetch(fresh, {
      cache: "no-store",
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
    });
    if (!res.ok) {
      throw new Error(
        `Couldn't read the Sheet (HTTP ${res.status}). Is it published to web as CSV?`
      );
    }
    return rowsToVolunteers(parseCsv(await res.text()));
  }

  // Same shape as the Sheet path — the UI must not care which source it got.
  const file = path.join(process.cwd(), "data", "volunteers.json");
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw).map((v) => ({
    name: (v.name || "").trim(),
    phone: normalizePhone(v.phone),
    type: (v.type || "").trim(),
    pillars: Array.isArray(v.pillars) ? v.pillars : [],
    roles: Array.isArray(v.roles) ? v.roles : [],
  }));
}

export function sourceLabel() {
  return SHEET_CSV_URL ? "Google Sheet" : "data/volunteers.json (seed)";
}

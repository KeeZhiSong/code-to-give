// Minimal .env / .env.local loader for the standalone scripts.
//
// Next.js loads both files automatically for the web app, with .env.local
// taking priority — scripts/listen.js is plain Node, so it needs this to get
// the same values. Imported FIRST (before config.js) — ES modules evaluate
// dependencies in import order, so this runs before anything reads process.env.
//
// Both files, not just .env.local: this project keeps most secrets
// (Supabase, GreenAPI) in plain .env and only occasionally adds local
// overrides to .env.local. A loader that only read .env.local silently saw
// none of that — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing meant
// eventsConfigured() came back false, so every event lookup fell back to the
// empty stand-in event from lib/config.js, no matter what was actually saved
// in Supabase via the website.

import { readFileSync } from "node:fs";
import path from "node:path";

function loadFile(filename) {
  try {
    const raw = readFileSync(path.join(process.cwd(), filename), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    // File doesn't exist — fine, the other file (or real env vars) may cover it.
  }
}

// Load .env.local FIRST so its values win (first-writer-wins below), then
// .env to fill in anything .env.local didn't set. Real exported env vars
// already in process.env before this runs are untouched either way.
loadFile(".env.local");
loadFile(".env");

// Minimal .env.local loader for the standalone scripts.
//
// Next.js loads .env.local automatically, but scripts/listen.js is plain Node,
// so it needs this. Imported FIRST (before config.js) — ES modules evaluate
// dependencies in import order, so this runs before anything reads process.env.

import { readFileSync } from "node:fs";
import path from "node:path";

try {
  const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
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
  // No .env.local — fall back to real env vars / config defaults.
}

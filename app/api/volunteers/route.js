import { NextResponse } from "next/server";
import { getVolunteers as readSheet, sourceLabel } from "../../../lib/sheets.js";
import { getOptOuts } from "../../../lib/store.js";
import {
  listVolunteers,
  countVolunteers,
  volunteersConfigured,
} from "../../../lib/volunteers.js";

export const dynamic = "force-dynamic";

/**
 * Recipients for the console.
 *
 * Reads the Supabase `volunteers` table when it's configured AND populated.
 * An empty table falls back to the sheet rather than showing an empty console —
 * so adding this feature can't strand a demo behind a sync nobody ran yet.
 * `needsSync` tells the UI to nudge.
 */
export async function GET() {
  try {
    let volunteers = null;
    let source;
    let needsSync = false;

    if (volunteersConfigured()) {
      try {
        if ((await countVolunteers()) > 0) {
          volunteers = await listVolunteers();
          source = "Supabase";
        } else {
          needsSync = true;
        }
      } catch {
        // Table not created yet, RLS misconfigured, Supabase down — none of
        // these should take the recipients pane down with them. Fall back to
        // the sheet, which is the source the form writes to anyway.
        needsSync = true;
      }
    }

    if (!volunteers) {
      volunteers = await readSheet();
      source = sourceLabel();
    }

    const optOuts = await getOptOuts();
    return NextResponse.json({
      source,
      needsSync,
      volunteers: volunteers.map((v) => ({
        ...v,
        optedOut: optOuts.includes(v.phone),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

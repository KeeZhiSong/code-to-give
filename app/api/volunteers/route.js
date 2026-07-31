import { NextResponse } from "next/server";
import { getVolunteers as readSheet, sourceLabel } from "../../../lib/sheets.js";
import { getOptOuts } from "../../../lib/store.js";
import {
  listVolunteers,
  countVolunteers,
  volunteersConfigured,
} from "../../../lib/volunteers.js";
import { listBeneficiaries } from "../../../lib/beneficiaries.js";

export const dynamic = "force-dynamic";

/**
 * Recipients for the console — volunteers AND beneficiaries.
 *
 * Both are people the organiser broadcasts to, so both belong here even though
 * they live in separate tables; splitting them without merging here would make
 * every beneficiary silently unreachable. Each carries `type` so the console
 * can filter.
 *
 * Reads Supabase when configured AND populated; an empty or missing table falls
 * back to the sheet rather than showing an empty console, so this can't strand a
 * demo behind a migration or a sync nobody ran.
 */
export async function GET() {
  try {
    let people = null;
    let source;
    let needsSync = false;

    if (volunteersConfigured()) {
      try {
        const [count, beneficiaries] = await Promise.all([
          countVolunteers(),
          // The beneficiaries table may not exist yet — that must not take the
          // whole recipients pane down with it.
          listBeneficiaries().catch(() => []),
        ]);
        if (count > 0 || beneficiaries.length > 0) {
          const volunteers = count > 0 ? await listVolunteers() : [];
          people = [...volunteers, ...beneficiaries];
          source = "Supabase";
        } else {
          needsSync = true;
        }
      } catch {
        // Table missing, RLS misconfigured, Supabase down — degrade to the
        // sheet, which is what the form writes to anyway.
        needsSync = true;
      }
    }

    if (!people) {
      people = await readSheet();
      source = sourceLabel();
    }

    const optOuts = await getOptOuts();
    return NextResponse.json({
      source,
      needsSync,
      volunteers: people.map((p) => ({
        ...p,
        optedOut: optOuts.includes(p.phone),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

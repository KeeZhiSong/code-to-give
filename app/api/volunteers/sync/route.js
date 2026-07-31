import { NextResponse } from "next/server";
import { syncFromSheet, volunteersConfigured } from "../../../../lib/volunteers.js";

export const dynamic = "force-dynamic";
// Reads the whole sheet and writes row by row; give it room on a big list.
export const maxDuration = 60;

/** Pull new and changed signups from the Google Form sheet into Supabase. */
export async function POST() {
  if (!volunteersConfigured()) {
    return NextResponse.json(
      {
        error:
          "Volunteers need Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await syncFromSheet());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

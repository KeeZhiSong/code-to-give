import { NextResponse } from "next/server";
import { listEvents } from "../../../lib/events.js";
import { getEventHeadcount } from "../../../lib/headcount.js";

export const dynamic = "force-dynamic";

// The Explorer was built against its own shape before events existed in the
// database. Rather than rewrite its whole UI, map real events into that shape
// here — one adapter in one place.

const PILLAR_SLUG = {
  "Items To Serve": "items",
  "Knowledge To Serve": "knowledge",
  "Peace To Serve": "peace",
};

// Rough region from the venue text. Events have no region column, and adding
// one is a migration for a field only this page filters on — so infer where we
// can and leave it null otherwise. A null region matches every region filter,
// so a real event is never hidden by a guess we couldn't make.
const REGION_HINTS = {
  North: ["woodlands", "yishun", "sembawang", "admiralty", "kranji", "mandai"],
  South: ["harbourfront", "telok blangah", "sentosa", "bukit merah"],
  East: ["tampines", "bedok", "pasir ris", "changi", "east coast", "simei"],
  West: ["jurong", "clementi", "boon lay", "tuas", "bukit batok"],
  Central: ["orchard", "toa payoh", "novena", "bishan", "city", "kallang"],
};

function regionFor(venue) {
  const text = String(venue || "").toLowerCase();
  if (!text) return null;
  for (const [region, hints] of Object.entries(REGION_HINTS)) {
    if (hints.some((h) => text.includes(h))) return region;
  }
  return null;
}

function timeLabel(startsAt) {
  if (!startsAt) return "Time to be confirmed";
  return new Date(startsAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET() {
  try {
    const events = (await listEvents()).filter((e) => !e.readOnly);

    const mapped = await Promise.all(
      events.map(async (e) => {
        // Spots left needs real confirmations, not just capacity.
        let confirmed = 0;
        try {
          const headcount = await getEventHeadcount(e.id);
          confirmed = headcount?.volunteers?.confirmed ?? 0;
        } catch {
          // Headcount unavailable — fall back to showing full capacity rather
          // than dropping the event from the list.
        }

        const pillar = PILLAR_SLUG[e.pillar] || "items";
        return {
          id: e.id,
          title: e.name,
          venue: e.venue || "Venue to be confirmed",
          pillar,
          // Real events are one-off unless a track marks them as a series.
          commitment: e.track ? "recurring" : "one-time",
          ...(e.track ? { frequency: e.track } : {}),
          region: regionFor(e.venue),
          date: e.starts_at ? String(e.starts_at).slice(0, 10) : null,
          time: timeLabel(e.starts_at),
          spotsTotal: e.capacity ?? null,
          spotsLeft:
            e.capacity != null ? Math.max(0, e.capacity - confirmed) : null,
          // Beneficiary view reuses the same events — PTS runs one event that
          // serves both audiences, not two parallel programmes.
          category: e.pillar || "Other",
          audience: "Everyone",
          accessibility: [],
        };
      })
    );

    // Undated events sort last; everything else soonest first.
    mapped.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    return NextResponse.json({ events: mapped });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getRoster, storeLabel } from "../../../lib/store.js";
import { EVENT } from "../../../lib/config.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const campaign = new URL(request.url).searchParams.get("campaign") || EVENT.campaign;
  try {
    const roster = await getRoster(campaign);
    return NextResponse.json({ campaign, store: storeLabel(), ...roster });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

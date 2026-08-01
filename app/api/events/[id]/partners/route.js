import { NextResponse } from "next/server";
import { listPartners, createPartner, PartnerError } from "../../../../../lib/partners.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const partners = await listPartners(id);
    return NextResponse.json({ partners });
  } catch (e) {
    const status = e instanceof PartnerError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const partner = await createPartner(id, await request.json());
    return NextResponse.json({ partner }, { status: 201 });
  } catch (e) {
    const status = e instanceof PartnerError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

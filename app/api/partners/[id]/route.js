import { NextResponse } from "next/server";
import { updatePartner, deletePartner, PartnerError } from "../../../../lib/partners.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const partner = await updatePartner(id, await request.json());
    return NextResponse.json({ partner });
  } catch (e) {
    const status = e instanceof PartnerError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  try {
    await deletePartner(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof PartnerError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

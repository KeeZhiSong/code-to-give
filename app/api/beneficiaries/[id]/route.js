import { NextResponse } from "next/server";
import {
  updateBeneficiary,
  deleteBeneficiary,
  BeneficiaryError,
} from "../../../../lib/beneficiaries.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const beneficiary = await updateBeneficiary(id, await request.json());
    return NextResponse.json({ beneficiary });
  } catch (e) {
    const status = e instanceof BeneficiaryError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  try {
    // Their attendance log cascades — removing someone removes their history.
    await deleteBeneficiary(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof BeneficiaryError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

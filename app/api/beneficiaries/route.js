import { NextResponse } from "next/server";
import {
  listBeneficiaries,
  createBeneficiary,
  beneficiariesConfigured,
  BeneficiaryError,
} from "../../../lib/beneficiaries.js";

export const dynamic = "force-dynamic";

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Beneficiaries need Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    },
    { status: 400 }
  );
}

/** The beneficiary list — courses and progress, not pillars and roles. */
export async function GET() {
  if (!beneficiariesConfigured()) return notConfigured();
  try {
    const beneficiaries = await listBeneficiaries();
    return NextResponse.json({ beneficiaries, total: beneficiaries.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Add someone by hand.
 *
 * Beneficiaries are met in person — a GIFTIK queue, a course sign-in — not
 * recruited through a link, so an organiser typing at a registration desk is
 * the realistic way most of them get in.
 */
export async function POST(request) {
  if (!beneficiariesConfigured()) return notConfigured();
  try {
    const beneficiary = await createBeneficiary(await request.json());
    return NextResponse.json({ beneficiary }, { status: 201 });
  } catch (e) {
    const status = e instanceof BeneficiaryError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

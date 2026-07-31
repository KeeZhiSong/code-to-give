import { NextResponse } from "next/server";
import {
  listBeneficiaries,
  beneficiariesConfigured,
} from "../../../lib/beneficiaries.js";

export const dynamic = "force-dynamic";

/** The beneficiary list on its own — courses and progress, not pillars/roles. */
export async function GET() {
  if (!beneficiariesConfigured()) {
    return NextResponse.json(
      {
        error:
          "Beneficiaries need Supabase. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 400 }
    );
  }
  try {
    const beneficiaries = await listBeneficiaries();
    return NextResponse.json({ beneficiaries, total: beneficiaries.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

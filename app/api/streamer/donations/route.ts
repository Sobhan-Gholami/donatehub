import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const method = searchParams.get("method");

  let query = `
    SELECT id, donor_name, donor_message, method, currency, amount,
           status, proof_reference, fx_rate_at_settlement, platform_fee_amount,
           created_at, paid_at, settled_at
    FROM donations WHERE streamer_id = ? AND is_test = 0
  `;
  const vals: any[] = [s.id];
  if (method) { query += " AND method = ?"; vals.push(method); }
  query += " ORDER BY created_at DESC LIMIT 500";

  const donations = db.prepare(query).all(...vals);
  return NextResponse.json({ donations });
}

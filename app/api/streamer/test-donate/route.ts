import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount) || 10000;

  db.prepare(`
    INSERT INTO donations (streamer_id, donor_name, donor_message, method, currency, amount, status, settled_at, is_test)
    VALUES (?, 'تست', 'این یک دونیت تستیه', 'toman', 'IRT', ?, 'settled', CURRENT_TIMESTAMP, 1)
  `).run(s.id, amount);

  return NextResponse.json({ ok: true });
}

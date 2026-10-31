import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const settings = db.prepare("SELECT * FROM platform_settings WHERE id = 1").get();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const body = await req.json();
  const fields = ["forex_paypal_email", "crypto_usdt_address", "crypto_network", "default_platform_fee_percent"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) { sets.push(`${f} = ?`); vals.push(body[f]); }
  }
  if (sets.length === 0) return NextResponse.json({ error: "چیزی برای آپدیت نیست" }, { status: 400 });
  db.prepare(`UPDATE platform_settings SET ${sets.join(", ")} WHERE id = 1`).run(...vals);
  return NextResponse.json({ ok: true });
}

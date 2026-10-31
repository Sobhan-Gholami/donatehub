import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getAlanchandRate, applyMargin } from "@/lib/exchangeRate";

const SYMBOL_MAP: Record<string, string> = { USD: "usd", EUR: "eur", USDT: "usdt" };

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const currency = (searchParams.get("currency") || "").toUpperCase();
  const symbol = SYMBOL_MAP[currency];
  if (!symbol) return NextResponse.json({ error: "ارز پشتیبانی نمی‌شود" }, { status: 400 });

  const result = await getAlanchandRate(symbol);
  if (!result.rate_toman) {
    return NextResponse.json({ error: result.error || "دریافت نرخ ناموفق بود" }, { status: 502 });
  }

  const settings = db.prepare("SELECT default_platform_fee_percent FROM platform_settings WHERE id = 1").get() as any;
  const margin = settings?.default_platform_fee_percent || 10;
  const finalRate = applyMargin(result.rate_toman, margin);

  return NextResponse.json({
    live_rate: result.rate_toman,
    margin_percent: margin,
    final_rate: Math.round(finalRate),
  });
}

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { creditTomanToStreamer } from "@/lib/donationCredit";

// Admin confirms a forex/crypto donation arrived, or settles it (pays streamer)
// fx_rate_at_settlement: toman value per 1 unit of currency, chosen at settlement time
// platform_fee_amount: fee amount (in same currency as donation) - borne by streamer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { action, fx_rate_at_settlement, platform_fee_amount, note } = body;
  // action: 'confirm' | 'settle' | 'fail'

  const donation = db.prepare("SELECT * FROM donations WHERE id = ?").get(id) as any;
  if (!donation) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  if (donation.is_test) return NextResponse.json({ error: "این یک دونیت تستی است و قابل تسویه نیست" }, { status: 400 });

  if (action === "confirm") {
    db.prepare("UPDATE donations SET status = 'confirmed', paid_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
      .run(id, "confirmed", note || "واریز دونیتور تایید شد", "admin");
  } else if (action === "settle") {
    // Toman (card-to-card) needs no currency conversion — it's a 1:1 credit.
    const rate = donation.method === "toman" ? 1 : Number(fx_rate_at_settlement);
    if (donation.method !== "toman" && !fx_rate_at_settlement) {
      return NextResponse.json({ error: "نرخ تبدیل لازم است" }, { status: 400 });
    }
    const toman_equivalent = donation.amount * rate - (Number(platform_fee_amount || 0) * rate);
    db.prepare(`
      UPDATE donations SET status = 'settled', settled_at = CURRENT_TIMESTAMP,
        fx_rate_at_settlement = ?, platform_fee_amount = ? WHERE id = ?
    `).run(rate, platform_fee_amount || 0, id);
    creditTomanToStreamer(donation.streamer_id, toman_equivalent);
    db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
      .run(id, "settled", note || (donation.method === "toman" ? "تایید نهایی واریز کارت‌به‌کارت" : `تسویه با نرخ ${rate}`), "admin");
  } else if (action === "fail") {
    db.prepare("UPDATE donations SET status = 'failed' WHERE id = ?").run(id);
    db.prepare("INSERT INTO transaction_logs (donation_id, event, detail, actor) VALUES (?,?,?,?)")
      .run(id, "failed", note || "", "admin");
  } else {
    return NextResponse.json({ error: "اکشن نامعتبر" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

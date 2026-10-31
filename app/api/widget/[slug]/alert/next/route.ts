import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const streamer = db.prepare("SELECT * FROM streamers WHERE slug = ? AND is_active = 1").get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  const donation = db.prepare(`
    SELECT * FROM donations
    WHERE streamer_id = ? AND status = 'settled' AND alerted_at IS NULL
    ORDER BY settled_at ASC LIMIT 1
  `).get(streamer.id) as any;

  if (!donation) return NextResponse.json({ donation: null });

  db.prepare("UPDATE donations SET alerted_at = CURRENT_TIMESTAMP WHERE id = ?").run(donation.id);

  const tomanAmount = donation.method === "toman"
    ? donation.amount
    : donation.amount * (donation.fx_rate_at_settlement || 0);

  return NextResponse.json({
    donation: {
      donor_name: donation.donor_name,
      donor_message: donation.donor_message,
      method: donation.method,
      currency: donation.currency,
      amount: donation.amount,
      toman_amount: tomanAmount,
    },
  });
}

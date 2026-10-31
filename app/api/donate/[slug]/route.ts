import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX === "true";

// Public endpoint - never exposes payout account details
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const streamer = db.prepare(`
    SELECT id, slug, display_name, avatar_url, bio, goal_title,
           goal_amount_toman, goal_current_toman,
           zarinpal_merchant_id IS NOT NULL AS has_toman
    FROM streamers WHERE slug = ? AND is_active = 1
  `).get(slug) as any;

  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  if (ZARINPAL_SANDBOX) streamer.has_toman = 1;

  const platform = db.prepare(`SELECT crypto_network FROM platform_settings WHERE id = 1`).get() as any;

  // Forex & crypto are always available (platform-level shared accounts).
  // The actual account identifiers are only revealed after the donor picks
  // a method (via /create), and never with any owner name attached.
  return NextResponse.json({
    streamer: { ...streamer, has_forex: true, has_crypto: true, crypto_network: platform?.crypto_network || "TRC20" },
  });
}

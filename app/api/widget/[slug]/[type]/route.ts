import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

const WIDGET_TYPES = ["goal", "donors", "donations", "alert"];

function tomanValue(d: any) {
  if (d.method === "toman") return d.amount;
  if (d.fx_rate_at_settlement) return d.amount * d.fx_rate_at_settlement;
  return 0;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; type: string }> }) {
  const { slug, type } = await params;
  if (!WIDGET_TYPES.includes(type)) return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });

  const streamer = db.prepare("SELECT * FROM streamers WHERE slug = ? AND is_active = 1").get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  const widget = db.prepare("SELECT * FROM widget_configs WHERE streamer_id = ? AND widget_type = ?").get(streamer.id, type) as any;
  const config = widget ? JSON.parse(widget.config_json) : {};
  const base = {
    config,
    volume: widget?.volume ?? 0.5,
    sound_url: widget?.sound_url || null,
    media_url: widget?.media_url || null,
    media_type: widget?.media_type || null,
  };

  if (type === "goal") {
    return NextResponse.json({
      ...base,
      goal_title: streamer.goal_title,
      goal_amount_toman: streamer.goal_amount_toman,
      goal_current_toman: streamer.goal_current_toman,
    });
  }

  if (type === "donors") {
    const settled = db.prepare(`
      SELECT donor_name, method, amount, fx_rate_at_settlement FROM donations
      WHERE streamer_id = ? AND status = 'settled' AND is_test = 0
    `).all(streamer.id) as any[];
    // Normalize name for matching (trim + lowercase) so "m.a", "M.A ", "m.a"
    // all count as the same person's running total, while still displaying
    // their most recently used capitalization.
    const totals = new Map<string, { name: string; total: number }>();
    for (const d of settled) {
      const key = (d.donor_name || "").trim().toLowerCase();
      const existing = totals.get(key);
      totals.set(key, { name: d.donor_name, total: (existing?.total || 0) + tomanValue(d) });
    }
    const list = [...totals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, config.max_items || 10);
    return NextResponse.json({ ...base, donors: list });
  }

  if (type === "donations") {
    const list = db.prepare(`
      SELECT donor_name, donor_message, method, currency, amount, created_at FROM donations
      WHERE streamer_id = ? AND status = 'settled' AND is_test = 0
      ORDER BY created_at DESC LIMIT ?
    `).all(streamer.id, config.max_items || 8);
    return NextResponse.json({ ...base, donations: list });
  }

  // 'alert' widget itself just needs config/media/sound — the alert queue
  // (which donation to show next) is served by /alert/next below.
  return NextResponse.json(base);
}

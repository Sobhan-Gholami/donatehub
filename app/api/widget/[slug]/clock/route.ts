import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const streamer = db.prepare(`
    SELECT clock_end_at, clock_initial_hours, clock_toman_per_minute, clock_color
    FROM streamers WHERE slug = ? AND is_active = 1
  `).get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  return NextResponse.json({
    clock_end_at: streamer.clock_end_at, // ISO-ish UTC string ("YYYY-MM-DD HH:MM:SS") or null if not started
    initial_hours: streamer.clock_initial_hours,
    color: streamer.clock_color || "#f2b84b",
  });
}

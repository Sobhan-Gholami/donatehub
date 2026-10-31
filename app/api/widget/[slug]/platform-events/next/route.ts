import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const streamer = db.prepare("SELECT * FROM streamers WHERE slug = ? AND is_active = 1").get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  const event = db.prepare(`
    SELECT * FROM platform_events WHERE streamer_id = ? AND shown_at IS NULL ORDER BY created_at ASC LIMIT 1
  `).get(streamer.id) as any;

  if (!event) return NextResponse.json({ event: null });
  db.prepare("UPDATE platform_events SET shown_at = CURRENT_TIMESTAMP WHERE id = ?").run(event.id);

  return NextResponse.json({
    event: { platform: event.platform, event_type: event.event_type, username: event.username, detail: event.detail },
  });
}

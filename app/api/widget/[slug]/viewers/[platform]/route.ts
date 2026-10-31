import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getKickViewers, getYoutubeViewers } from "@/lib/liveViewers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; platform: string }> }) {
  const { slug, platform } = await params;
  if (platform !== "kick" && platform !== "youtube") {
    return NextResponse.json({ error: "پلتفرم نامعتبر" }, { status: 400 });
  }

  const streamer = db.prepare("SELECT * FROM streamers WHERE slug = ? AND is_active = 1").get(slug) as any;
  if (!streamer) return NextResponse.json({ error: "استریمر پیدا نشد" }, { status: 404 });

  const channel = platform === "kick" ? streamer.kick_channel : streamer.youtube_channel;
  const enabled = platform === "kick" ? streamer.kick_enabled : streamer.youtube_enabled;

  if (!channel || !enabled) {
    return NextResponse.json({ enabled: false, live: false, viewers: 0 });
  }

  const result = platform === "kick" ? await getKickViewers(channel) : await getYoutubeViewers(channel);
  return NextResponse.json({ enabled: true, ...result });
}

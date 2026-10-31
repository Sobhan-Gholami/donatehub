import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const rows = db.prepare(`
    SELECT platform, platform_username, connected_at FROM platform_connections WHERE streamer_id = ?
  `).all(s.id) as any[];

  const connections = { kick: null as any, youtube: null as any };
  for (const r of rows) connections[r.platform as "kick" | "youtube"] = r;

  return NextResponse.json({ connections });
}

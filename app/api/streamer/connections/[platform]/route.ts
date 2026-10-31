import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { platform } = await params;
  if (platform !== "kick" && platform !== "youtube") return NextResponse.json({ error: "نامعتبر" }, { status: 400 });

  db.prepare("DELETE FROM platform_connections WHERE streamer_id = ? AND platform = ?").run(s.id, platform);
  return NextResponse.json({ ok: true });
}

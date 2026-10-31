import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

const WIDGET_TYPES = ["goal", "donors", "donations", "alert"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { type } = await params;
  if (!WIDGET_TYPES.includes(type)) return NextResponse.json({ error: "نوع نامعتبر" }, { status: 400 });

  const body = await req.json();
  const { config, volume } = body;

  const existing = db.prepare("SELECT * FROM widget_configs WHERE streamer_id = ? AND widget_type = ?").get(s.id, type) as any;
  if (!existing) {
    db.prepare("INSERT INTO widget_configs (streamer_id, widget_type, config_json, volume) VALUES (?,?,?,?)")
      .run(s.id, type, JSON.stringify(config || {}), volume ?? 0.5);
  } else {
    const mergedConfig = config ? { ...JSON.parse(existing.config_json), ...config } : JSON.parse(existing.config_json);
    db.prepare("UPDATE widget_configs SET config_json = ?, volume = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(JSON.stringify(mergedConfig), volume ?? existing.volume, existing.id);
  }
  return NextResponse.json({ ok: true });
}

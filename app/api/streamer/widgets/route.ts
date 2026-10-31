import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

const WIDGET_TYPES = ["goal", "donors", "donations", "alert"] as const;

const DEFAULT_CONFIG: Record<string, any> = {
  goal: {
    bg_color: "#0a0a0a00", wave_color: "#3ba7ff", text_color: "#ffffff",
    show_percent: true, template: "bottle",
  },
  donors: { bg_color: "#0a0a0a00", text_color: "#ffffff", max_items: 10, title: "برترین حامیان" },
  donations: { bg_color: "#0a0a0a00", text_color: "#ffffff", max_items: 8 },
  alert: {
    bg_color: "#00000000", text_color: "#ffffff", duration_seconds: 6,
    message_template: "{name} مبلغ {amount} دونیت کرد!",
  },
};

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const widgets: any[] = [];
  for (const type of WIDGET_TYPES) {
    let row = db.prepare("SELECT * FROM widget_configs WHERE streamer_id = ? AND widget_type = ?").get(s.id, type) as any;
    if (!row) {
      db.prepare("INSERT INTO widget_configs (streamer_id, widget_type, config_json) VALUES (?,?,?)")
        .run(s.id, type, JSON.stringify(DEFAULT_CONFIG[type]));
      row = db.prepare("SELECT * FROM widget_configs WHERE streamer_id = ? AND widget_type = ?").get(s.id, type);
    }
    widgets.push({ ...row, config: JSON.parse(row.config_json) });
  }
  return NextResponse.json({ widgets });
}

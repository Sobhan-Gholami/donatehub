import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const streamer = db.prepare("SELECT clock_initial_hours FROM streamers WHERE id = ?").get(s.id) as any;
  const hours = streamer?.clock_initial_hours || 0;
  if (hours <= 0) {
    return NextResponse.json({ error: "اول ساعت اولیه رو توی تنظیمات وارد کن" }, { status: 400 });
  }

  db.prepare("UPDATE streamers SET clock_end_at = datetime('now', ?) WHERE id = ?")
    .run(`+${hours} hours`, s.id);

  return NextResponse.json({ ok: true });
}

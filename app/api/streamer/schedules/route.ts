import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const schedules = db.prepare("SELECT * FROM scheduled_messages WHERE streamer_id = ? ORDER BY id DESC").all(s.id);
  return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const body = await req.json();
  const { message, interval_minutes, platforms } = body;
  if (!message || !interval_minutes) return NextResponse.json({ error: "متن پیام و فاصله زمانی الزامی است" }, { status: 400 });
  if (Number(interval_minutes) < 1) return NextResponse.json({ error: "حداقل فاصله زمانی ۱ دقیقه است" }, { status: 400 });

  const count = db.prepare("SELECT COUNT(*) as c FROM scheduled_messages WHERE streamer_id = ?").get(s.id) as any;
  if (count.c >= 20) return NextResponse.json({ error: "حداکثر ۲۰ پیام زمان‌بندی‌شده مجاز است" }, { status: 400 });

  db.prepare("INSERT INTO scheduled_messages (streamer_id, message, interval_minutes, platforms) VALUES (?,?,?,?)")
    .run(s.id, message, Number(interval_minutes), JSON.stringify(platforms || ["kick", "youtube"]));
  return NextResponse.json({ ok: true });
}

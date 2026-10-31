import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

const DEFAULT_COMMANDS = [
  { trigger: ".donate", response: "برای حمایت از استریم از این لینک استفاده کن: {donate_link}" },
  { trigger: ".goal", response: "پیشرفت هدف فعلی: {goal_current} از {goal_amount} تومان" },
  { trigger: ".commands", response: "لیست کامندهای این چنل رو توی پنل استریمر ببین." },
];

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const existing = db.prepare("SELECT COUNT(*) as c FROM chat_commands WHERE streamer_id = ?").get(s.id) as any;
  if (existing.c === 0) {
    for (const c of DEFAULT_COMMANDS) {
      db.prepare("INSERT INTO chat_commands (streamer_id, trigger, response, is_default) VALUES (?,?,?,1)")
        .run(s.id, c.trigger, c.response);
    }
  }

  const commands = db.prepare("SELECT * FROM chat_commands WHERE streamer_id = ? ORDER BY is_default DESC, id ASC").all(s.id);
  return NextResponse.json({ commands });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const body = await req.json();
  let { trigger, response, platforms } = body;
  if (!trigger || !response) return NextResponse.json({ error: "دستور و پاسخ الزامی است" }, { status: 400 });
  trigger = trigger.trim();
  if (!trigger.startsWith(".")) trigger = "." + trigger;

  const customCount = db.prepare("SELECT COUNT(*) as c FROM chat_commands WHERE streamer_id = ? AND is_default = 0")
    .get(s.id) as any;
  if (customCount.c >= 50) {
    return NextResponse.json({ error: "حداکثر ۵۰ کامند سفارشی مجاز است" }, { status: 400 });
  }

  try {
    db.prepare("INSERT INTO chat_commands (streamer_id, trigger, response, platforms) VALUES (?,?,?,?)")
      .run(s.id, trigger, response, JSON.stringify(platforms || ["kick", "youtube"]));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return NextResponse.json({ error: "این دستور از قبل وجود دارد" }, { status: 409 });
    }
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

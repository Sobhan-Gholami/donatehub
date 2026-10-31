import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const cmd = db.prepare("SELECT * FROM chat_commands WHERE id = ? AND streamer_id = ?").get(id, s.id);
  if (!cmd) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const sets: string[] = [];
  const vals: any[] = [];
  if ("response" in body) { sets.push("response = ?"); vals.push(body.response); }
  if ("enabled" in body) { sets.push("enabled = ?"); vals.push(body.enabled ? 1 : 0); }
  if ("platforms" in body) { sets.push("platforms = ?"); vals.push(JSON.stringify(body.platforms)); }
  if (sets.length === 0) return NextResponse.json({ error: "چیزی برای آپدیت نیست" }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE chat_commands SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;

  const cmd = db.prepare("SELECT * FROM chat_commands WHERE id = ? AND streamer_id = ?").get(id, s.id) as any;
  if (!cmd) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  if (cmd.is_default) return NextResponse.json({ error: "کامندهای پیش‌فرض قابل حذف نیستند، فقط غیرفعال کن" }, { status: 400 });

  db.prepare("DELETE FROM chat_commands WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

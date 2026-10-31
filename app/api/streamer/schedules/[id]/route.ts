import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const row = db.prepare("SELECT * FROM scheduled_messages WHERE id = ? AND streamer_id = ?").get(id, s.id);
  if (!row) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  const body = await req.json();
  const sets: string[] = [];
  const vals: any[] = [];
  if ("message" in body) { sets.push("message = ?"); vals.push(body.message); }
  if ("interval_minutes" in body) { sets.push("interval_minutes = ?"); vals.push(Number(body.interval_minutes)); }
  if ("enabled" in body) { sets.push("enabled = ?"); vals.push(body.enabled ? 1 : 0); }
  if ("platforms" in body) { sets.push("platforms = ?"); vals.push(JSON.stringify(body.platforms)); }
  if (sets.length === 0) return NextResponse.json({ error: "چیزی برای آپدیت نیست" }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE scheduled_messages SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  db.prepare("DELETE FROM scheduled_messages WHERE id = ? AND streamer_id = ?").run(id, s.id);
  return NextResponse.json({ ok: true });
}

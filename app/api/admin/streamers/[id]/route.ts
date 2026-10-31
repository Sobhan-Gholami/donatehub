import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { parseKickChannel, parseYoutubeChannel } from "@/lib/liveViewers";

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const streamer = db.prepare("SELECT * FROM streamers WHERE id = ?").get(id);
  if (!streamer) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });
  return NextResponse.json({ streamer });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const fields = [
    "display_name","avatar_url","bio","goal_title","goal_amount_toman",
    "zarinpal_merchant_id","toman_card_number","toman_card_owner_name",
    "payout_bank_card","payout_bank_sheba","payout_bank_owner_name","is_active",
  ];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of fields) {
    if (f in body) {
      sets.push(`${f} = ?`);
      vals.push(body[f]);
    }
  }
  if (body.password) {
    sets.push("password_hash = ?");
    vals.push(hashPassword(body.password));
  }
  if ("kick_url" in body) {
    sets.push("kick_channel = ?");
    vals.push(body.kick_url ? parseKickChannel(body.kick_url) : null);
  }
  if ("youtube_url" in body) {
    sets.push("youtube_channel = ?");
    vals.push(body.youtube_url ? parseYoutubeChannel(body.youtube_url) : null);
  }
  if (sets.length === 0) return NextResponse.json({ error: "چیزی برای آپدیت نیست" }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE streamers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  const { id } = await params;
  db.prepare("DELETE FROM streamers WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

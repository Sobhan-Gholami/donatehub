import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { nanoid } from "nanoid";
import { parseKickChannel, parseYoutubeChannel } from "@/lib/liveViewers";

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return s;
}

export async function GET() {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const streamers = db.prepare(`
    SELECT id, slug, display_name, username, avatar_url, goal_title,
           goal_amount_toman, goal_current_toman, is_active, created_at
    FROM streamers ORDER BY created_at DESC
  `).all();
  return NextResponse.json({ streamers });
}

export async function POST(req: NextRequest) {
  const s = await requireAdmin();
  if (!s) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const body = await req.json();
  const {
    display_name, username, password, slug,
    zarinpal_merchant_id, toman_card_number, toman_card_owner_name,
    payout_bank_card, payout_bank_sheba, payout_bank_owner_name,
    goal_title, goal_amount_toman, bio, avatar_url,
    kick_url, youtube_url,
  } = body;

  if (!display_name || !username || !password) {
    return NextResponse.json({ error: "نام، یوزرنیم و پسورد الزامی است" }, { status: 400 });
  }

  const finalSlug = slug || (username as string).toLowerCase().replace(/[^a-z0-9-]/g, "") || nanoid(8);
  const kickChannel = kick_url ? parseKickChannel(kick_url) : null;
  const youtubeChannel = youtube_url ? parseYoutubeChannel(youtube_url) : null;

  try {
    const info = db.prepare(`
      INSERT INTO streamers (
        slug, display_name, username, password_hash, avatar_url, bio,
        goal_title, goal_amount_toman,
        zarinpal_merchant_id, toman_card_number, toman_card_owner_name,
        payout_bank_card, payout_bank_sheba, payout_bank_owner_name,
        kick_channel, youtube_channel
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      finalSlug, display_name, username, hashPassword(password), avatar_url || null, bio || null,
      goal_title || null, goal_amount_toman || 0,
      zarinpal_merchant_id || null, toman_card_number || null, toman_card_owner_name || null,
      payout_bank_card || null, payout_bank_sheba || null, payout_bank_owner_name || null,
      kickChannel, youtubeChannel
    );
    return NextResponse.json({ ok: true, id: info.lastInsertRowid, slug: finalSlug });
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return NextResponse.json({ error: "این یوزرنیم یا اسلاگ قبلاً استفاده شده" }, { status: 409 });
    }
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

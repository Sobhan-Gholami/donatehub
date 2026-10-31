import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const streamer = db.prepare(`
    SELECT id, slug, display_name, username, avatar_url, bio,
           goal_title, goal_amount_toman, goal_current_toman,
           toman_card_number,
           payout_bank_card, payout_bank_sheba, payout_bank_owner_name,
           kick_channel, kick_enabled, youtube_channel, youtube_enabled,
           clock_initial_hours, clock_toman_per_minute, clock_color, clock_end_at
    FROM streamers WHERE id = ?
  `).get(s.id);

  const totals = db.prepare(`
    SELECT method,
      SUM(CASE WHEN status IN ('confirmed','settled') THEN amount ELSE 0 END) AS confirmed_amount,
      SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_amount
    FROM donations WHERE streamer_id = ? AND is_test = 0 GROUP BY method
  `).all(s.id);

  return NextResponse.json({ streamer, totals });
}

// Streamer can edit their own presentation fields plus account fields
// (username, slug/URL, password). Payout/settlement accounts stay admin-only.
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });

  const body = await req.json();
  const allowed = [
    "display_name", "avatar_url", "bio", "goal_title", "goal_amount_toman", "username", "slug",
    "clock_initial_hours", "clock_toman_per_minute", "clock_color",
  ];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of allowed) {
    if (f in body && body[f] !== "") { sets.push(`${f} = ?`); vals.push(body[f]); }
  }
  if (body.password) {
    sets.push("password_hash = ?");
    vals.push(hashPassword(body.password));
  }
  // Streamer can only flip the on/off toggle — the channel itself is admin-set.
  if ("kick_enabled" in body) { sets.push("kick_enabled = ?"); vals.push(body.kick_enabled ? 1 : 0); }
  if ("youtube_enabled" in body) { sets.push("youtube_enabled = ?"); vals.push(body.youtube_enabled ? 1 : 0); }
  if (sets.length === 0) return NextResponse.json({ error: "چیزی برای آپدیت نیست" }, { status: 400 });
  vals.push(s.id);

  try {
    db.prepare(`UPDATE streamers SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) {
      return NextResponse.json({ error: "این یوزرنیم یا لینک قبلاً استفاده شده" }, { status: 409 });
    }
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

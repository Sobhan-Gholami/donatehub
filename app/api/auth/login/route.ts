import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password, role } = await req.json();
  if (!username || !password || !role) {
    return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 });
  }

  if (role === "admin") {
    const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username) as any;
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return NextResponse.json({ error: "نام کاربری یا رمز اشتباه است" }, { status: 401 });
    }
    await setSessionCookie({ role: "admin", id: admin.id, username: admin.username });
    return NextResponse.json({ ok: true });
  }

  if (role === "streamer") {
    const streamer = db.prepare("SELECT * FROM streamers WHERE username = ?").get(username) as any;
    if (!streamer || !verifyPassword(password, streamer.password_hash)) {
      return NextResponse.json({ error: "نام کاربری یا رمز اشتباه است" }, { status: 401 });
    }
    if (!streamer.is_active) {
      return NextResponse.json({ error: "حساب شما غیرفعال است" }, { status: 403 });
    }
    await setSessionCookie({ role: "streamer", id: streamer.id, username: streamer.username });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "نقش نامعتبر" }, { status: 400 });
}

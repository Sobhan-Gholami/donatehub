import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { youtubeAuthorizeUrl, baseUrl } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.redirect(new URL("/streamer/login", baseUrl(req)));

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID تنظیم نشده — اول در .env.local اضافه کن" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl(req)}/api/auth/youtube/callback`;
  const url = youtubeAuthorizeUrl({ redirectUri, state });

  const res = NextResponse.redirect(url);
  res.cookies.set("youtube_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}

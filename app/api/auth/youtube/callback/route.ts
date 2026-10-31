import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { youtubeExchangeCode, baseUrl } from "@/lib/oauth";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.redirect(new URL("/streamer/login", baseUrl(req)));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = req.cookies.get("youtube_oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/streamer/dashboard?connect=youtube_failed", baseUrl(req)));
  }

  try {
    const redirectUri = `${baseUrl(req)}/api/auth/youtube/callback`;
    const tokens = await youtubeExchangeCode(code, redirectUri);

    const meRes = await fetchWithRetry(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const me = await meRes.json();
    const channel = me?.items?.[0];

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    db.prepare(`
      INSERT INTO platform_connections (streamer_id, platform, access_token, refresh_token, expires_at, platform_user_id, platform_username)
      VALUES (?, 'youtube', ?, ?, ?, ?, ?)
      ON CONFLICT(streamer_id, platform) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, platform_connections.refresh_token),
        expires_at = excluded.expires_at, platform_user_id = excluded.platform_user_id,
        platform_username = excluded.platform_username, connected_at = CURRENT_TIMESTAMP
    `).run(s.id, tokens.access_token, tokens.refresh_token || null, expiresAt, channel?.id || "", channel?.snippet?.title || null);

    const res = NextResponse.redirect(new URL("/streamer/dashboard?connect=youtube_ok", baseUrl(req)));
    res.cookies.delete("youtube_oauth_state");
    return res;
  } catch (e) {
    console.error("YouTube OAuth callback error:", e);
    return NextResponse.redirect(new URL("/streamer/dashboard?connect=youtube_failed", baseUrl(req)));
  }
}

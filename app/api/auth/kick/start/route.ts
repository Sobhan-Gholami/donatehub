import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { kickAuthorizeUrl, kickPkce, baseUrl } from "@/lib/oauth";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "streamer") return NextResponse.redirect(new URL("/streamer/login", baseUrl(req)));

  if (!process.env.KICK_CLIENT_ID) {
    return NextResponse.json({ error: "KICK_CLIENT_ID تنظیم نشده — اول در .env.local اضافه کن" }, { status: 500 });
  }

  const { verifier, challenge } = kickPkce();
  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl(req)}/api/auth/kick/callback`;
  const url = kickAuthorizeUrl({ redirectUri, state, codeChallenge: challenge });

  const res = NextResponse.redirect(url);
  res.cookies.set("kick_oauth_verifier", verifier, { httpOnly: true, maxAge: 600, path: "/" });
  res.cookies.set("kick_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}

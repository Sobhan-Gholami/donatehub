import crypto from "crypto";
import { fetchWithRetry } from "@/lib/fetchWithRetry";

export function baseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin;
}

// ---------- Kick (OAuth 2.1 + PKCE) ----------
export function kickPkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function kickAuthorizeUrl(opts: { redirectUri: string; state: string; codeChallenge: string }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.KICK_CLIENT_ID || "",
    redirect_uri: opts.redirectUri,
    scope: "user:read channel:read chat:write events:subscribe",
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    state: opts.state,
  });
  return `https://id.kick.com/oauth/authorize?${params.toString()}`;
}

export async function kickExchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  const res = await fetchWithRetry("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KICK_CLIENT_ID || "",
      client_secret: process.env.KICK_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`Kick token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function kickRefreshToken(refreshToken: string) {
  const res = await fetchWithRetry("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.KICK_CLIENT_ID || "",
      client_secret: process.env.KICK_CLIENT_SECRET || "",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Kick token refresh failed: ${await res.text()}`);
  return res.json();
}

// App Access Token (client credentials) — for reading public data (channel
// info, chatroom id, etc.) that isn't tied to any specific user's
// permissions. A per-user token can 401 on these even with channel:read
// granted, because that scope covers the user's *own* channel management,
// not general public lookups.
let cachedAppToken: { token: string; expiresAt: number } | null = null;

export async function getKickAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return cachedAppToken.token;
  }
  const res = await fetchWithRetry("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.KICK_CLIENT_ID || "",
      client_secret: process.env.KICK_CLIENT_SECRET || "",
    }),
  });
  if (!res.ok) throw new Error(`Kick app token request failed: ${await res.text()}`);
  const data = await res.json();
  cachedAppToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedAppToken.token;
}

// ---------- YouTube / Google (standard OAuth2) ----------
export function youtubeAuthorizeUrl(opts: { redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ].join(" "),
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function youtubeExchangeCode(code: string, redirectUri: string) {
  const res = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`YouTube token exchange failed: ${await res.text()}`);
  return res.json();
}

export async function youtubeRefreshToken(refreshToken: string) {
  const res = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`);
  return res.json();
}

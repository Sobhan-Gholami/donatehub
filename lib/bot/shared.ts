import db from "@/lib/db";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { youtubeRefreshToken, kickRefreshToken } from "@/lib/oauth";

export function fillTemplate(text: string, streamer: any) {
  const donateLink = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/d/${streamer.slug}`;
  return text
    .replace(/\{donate_link\}/g, donateLink)
    .replace(/\{goal_current\}/g, Math.round(streamer.goal_current_toman || 0).toLocaleString("en-US"))
    .replace(/\{goal_amount\}/g, Math.round(streamer.goal_amount_toman || 0).toLocaleString("en-US"))
    .replace(/\{streamer_name\}/g, streamer.display_name || "");
}

export function matchCommand(commands: any[], messageText: string, platform: "kick" | "youtube") {
  const text = messageText.trim();
  if (!text.startsWith(".")) return null;
  const firstWord = text.split(/\s+/)[0].toLowerCase();
  return commands.find((c) => {
    if (!c.enabled) return false;
    if (c.trigger.toLowerCase() !== firstWord) return false;
    try {
      const platforms = JSON.parse(c.platforms || '["kick","youtube"]');
      return platforms.includes(platform);
    } catch {
      return true;
    }
  }) || null;
}

export function getEnabledCommands(streamerId: number) {
  return db.prepare("SELECT * FROM chat_commands WHERE streamer_id = ? AND enabled = 1").all(streamerId) as any[];
}

export function getStreamer(streamerId: number) {
  return db.prepare("SELECT * FROM streamers WHERE id = ?").get(streamerId) as any;
}

// Ensures a YouTube access token is fresh, refreshing + persisting if needed.
export async function ensureYoutubeToken(conn: any): Promise<string | null> {
  if (!conn.expires_at || new Date(conn.expires_at).getTime() > Date.now() + 60_000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return null;
  try {
    const tokens = await youtubeRefreshToken(conn.refresh_token);
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    db.prepare("UPDATE platform_connections SET access_token = ?, expires_at = ? WHERE id = ?")
      .run(tokens.access_token, expiresAt, conn.id);
    return tokens.access_token;
  } catch (e) {
    console.error("Failed to refresh YouTube token for connection", conn.id, e);
    return null;
  }
}

export function logPlatformEvent(streamerId: number, platform: "kick" | "youtube", eventType: string, username: string, detail?: string) {
  db.prepare("INSERT INTO platform_events (streamer_id, platform, event_type, username, detail) VALUES (?,?,?,?,?)")
    .run(streamerId, platform, eventType, username, detail || null);
}

// Ensures a Kick access token is fresh, refreshing + persisting if needed.
// Kick tokens expire after ~1 hour; without this, any connection idle for a
// while starts failing every API call with 401 Unauthorized.
export async function ensureKickToken(conn: any): Promise<string | null> {
  if (!conn.expires_at || new Date(conn.expires_at).getTime() > Date.now() + 60_000) {
    return conn.access_token;
  }
  if (!conn.refresh_token) return null;
  try {
    const tokens = await kickRefreshToken(conn.refresh_token);
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    db.prepare("UPDATE platform_connections SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?")
      .run(tokens.access_token, tokens.refresh_token || conn.refresh_token, expiresAt, conn.id);
    return tokens.access_token;
  } catch (e) {
    console.error("[kick] failed to refresh token for connection", conn.id, e);
    return null;
  }
}

export { fetchWithRetry };

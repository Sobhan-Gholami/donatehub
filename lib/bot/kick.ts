import WebSocket from "ws";
import db from "@/lib/db";
import { getKickAppAccessToken } from "@/lib/oauth";
import { fetchWithRetry, matchCommand, getEnabledCommands, getStreamer, fillTemplate, logPlatformEvent, ensureKickToken } from "@/lib/bot/shared";

// Kick's chat runs on a public Pusher app that anyone can read without auth
// (this is the same connection kick.com itself uses to render chat).
// We speak the Pusher protocol directly over `ws` instead of using the
// `pusher-js` package, which assumes a browser environment and fails
// silently (no error, no connection, no logs) when run inside Node.js.
const KICK_PUSHER_APP_KEY = "32cbd69e4b950bf97679";
const KICK_PUSHER_CLUSTER = "us2";
const PUSHER_WS_URL = `wss://ws-${KICK_PUSHER_CLUSTER}.pusher.com/app/${KICK_PUSHER_APP_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

const activeConnections = new Map<number, WebSocket>(); // streamerId -> socket

// kick.com's internal /api/v2/... endpoint is behind Cloudflare bot
// protection and reliably blocks server-to-server requests (works fine from
// a browser, not from a hosted app). We use the official, documented public
// API instead. This is public data (not the user's private info), so it
// needs an App Access Token, not a per-user token — a user token can 401
// here even with channel:read granted.
async function getChatroomId(slug: string): Promise<number | null> {
  try {
    const appToken = await getKickAppAccessToken();
    const res = await fetchWithRetry(
      `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${appToken}` } }
    );
    const body = await res.text();
    if (!res.ok) {
      console.error(`[kick] channel lookup failed for '${slug}':`, res.status, body);
      return null;
    }
    const data = JSON.parse(body);
    const channel = data?.data?.[0];
    // The official public API doesn't expose a distinct chatroom_id field —
    // on current Kick, the chatroom id matches the broadcaster's user id.
    const chatroomId = channel?.chatroom_id ?? channel?.chatroom?.id ?? channel?.broadcaster_user_id ?? null;
    if (!chatroomId) {
      console.error(`[kick] no chatroom_id/broadcaster_user_id in response for '${slug}':`, body);
    } else {
      console.log(`[kick] resolved chatroom id ${chatroomId} for '${slug}'`);
    }
    return chatroomId;
  } catch (e) {
    console.error(`[kick] channel lookup threw for '${slug}':`, e);
    return null;
  }
}

// Confirmed against https://docs.kick.com: POST /public/v1/chat with a
// bearer token that has chat:write. We authenticate as the streamer's own
// Kick account (not a separate bot identity), so messages must be sent with
// type "user" + broadcaster_user_id — type "bot" is only for apps that have
// their own dedicated bot account token.
async function sendKickMessage(accessToken: string, broadcasterUserId: string, content: string) {
  try {
    const res = await fetchWithRetry("https://api.kick.com/public/v1/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ broadcaster_user_id: Number(broadcasterUserId), content, type: "user" }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[kick] sendMessage failed:", res.status, body);
    } else {
      console.log("[kick] sendMessage ok:", body);
    }
  } catch (e) {
    console.error("[kick] failed to send chat message:", e);
  }
}

export async function startKickListener(streamerId: number) {
  if (activeConnections.has(streamerId)) return;

  const streamer = getStreamer(streamerId);
  const conn = db.prepare("SELECT * FROM platform_connections WHERE streamer_id = ? AND platform = 'kick'").get(streamerId) as any;
  if (!streamer?.kick_channel || !conn) return;

  const accessToken = await ensureKickToken(conn);
  if (!accessToken) {
    console.error(`[kick] no valid access token for streamer ${streamerId} (re-connect needed)`);
    return;
  }

  const chatroomId = await getChatroomId(streamer.kick_channel);
  if (!chatroomId) {
    console.error(`[kick] could not resolve chatroom id for '${streamer.kick_channel}'`);
    return;
  }

  console.log(`[kick] connecting chat listener for streamer ${streamerId}, chatroom ${chatroomId}`);
  const ws = new WebSocket(PUSHER_WS_URL);
  activeConnections.set(streamerId, ws);

  ws.on("open", () => {
    console.log(`[kick] socket open for streamer ${streamerId}`);
  });

  ws.on("message", async (raw) => {
    try {
      const outer = JSON.parse(raw.toString());

      if (outer.event === "pusher:connection_established") {
        ws.send(JSON.stringify({
          event: "pusher:subscribe",
          data: { channel: `chatrooms.${chatroomId}.v2` },
        }));
        return;
      }

      if (outer.event === "App\\Events\\ChatMessageSentEvent") {
        const data = JSON.parse(outer.data);
        const text: string = data?.content || data?.message?.message || "";
        console.log(`[kick] chat message from ${data?.sender?.username || "?"} on streamer ${streamerId}: ${text}`);
        const commands = getEnabledCommands(streamerId);
        const cmd = matchCommand(commands, text, "kick");
        if (cmd) {
          console.log(`[kick] matched command '${cmd.trigger}' for streamer ${streamerId}`);
          const freshStreamer = getStreamer(streamerId);
          const freshConn = db.prepare("SELECT * FROM platform_connections WHERE streamer_id = ? AND platform = 'kick'").get(streamerId) as any;
          const freshToken = freshConn ? await ensureKickToken(freshConn) : null;
          if (freshToken) {
            await sendKickMessage(freshToken, conn.platform_user_id, fillTemplate(cmd.response, freshStreamer));
          }
        }
        return;
      }

      // Kick surfaces follower/sub activity as special events on the same
      // socket. Event names are best-effort — confirm against live traffic
      // and adjust if these don't match what actually arrives.
      if (outer.event === "App\\Events\\FollowersUpdated" || outer.event === "App\\Events\\FollowerEvent") {
        const data = JSON.parse(outer.data);
        logPlatformEvent(streamerId, "kick", "follow", data?.username || data?.user?.username || "someone");
        return;
      }
      if (outer.event === "App\\Events\\SubscriptionEvent") {
        const data = JSON.parse(outer.data);
        logPlatformEvent(streamerId, "kick", "sub", data?.username || data?.user?.username || "someone");
        return;
      }
    } catch (e) {
      console.error(`[kick] message handling error for streamer ${streamerId}:`, e);
    }
  });

  ws.on("error", (err) => {
    console.error(`[kick] socket error for streamer ${streamerId}:`, err);
  });

  ws.on("close", () => {
    console.log(`[kick] socket closed for streamer ${streamerId}, will reconnect on next check`);
    activeConnections.delete(streamerId);
  });
}

export function stopKickListener(streamerId: number) {
  const ws = activeConnections.get(streamerId);
  if (ws) {
    ws.close();
    activeConnections.delete(streamerId);
  }
}

export async function sendKickScheduledMessage(streamerId: number, message: string) {
  const conn = db.prepare("SELECT * FROM platform_connections WHERE streamer_id = ? AND platform = 'kick'").get(streamerId) as any;
  if (!conn) return;
  const accessToken = await ensureKickToken(conn);
  if (!accessToken) return;
  const streamer = getStreamer(streamerId);
  await sendKickMessage(accessToken, conn.platform_user_id, fillTemplate(message, streamer));
}

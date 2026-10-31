import db from "@/lib/db";
import { fetchWithRetry, matchCommand, getEnabledCommands, getStreamer, fillTemplate, ensureYoutubeToken, logPlatformEvent } from "@/lib/bot/shared";

type ChatState = { liveChatId: string; nextPageToken?: string };
const chatState = new Map<number, ChatState>(); // streamerId -> state

async function findActiveLiveChatId(accessToken: string): Promise<string | null> {
  const res = await fetchWithRetry(
    "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.items?.[0]?.snippet?.liveChatId || null;
}

async function sendYoutubeMessage(accessToken: string, liveChatId: string, text: string) {
  try {
    await fetchWithRetry(
      "https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          snippet: { liveChatId, type: "textMessageEvent", textMessageDetails: { messageText: text } },
        }),
      }
    );
  } catch (e) {
    console.error("Failed to send YouTube chat message:", e);
  }
}

export async function pollYoutubeChat(streamerId: number) {
  const streamer = getStreamer(streamerId);
  const conn = db.prepare("SELECT * FROM platform_connections WHERE streamer_id = ? AND platform = 'youtube'").get(streamerId) as any;
  if (!streamer?.youtube_enabled || !conn) return;

  const accessToken = await ensureYoutubeToken(conn);
  if (!accessToken) return;

  let state = chatState.get(streamerId);
  if (!state) {
    const liveChatId = await findActiveLiveChatId(accessToken);
    if (!liveChatId) return; // not live right now
    state = { liveChatId };
    chatState.set(streamerId, state);
  }

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");
    url.searchParams.set("liveChatId", state.liveChatId);
    url.searchParams.set("part", "snippet,authorDetails");
    if (state.nextPageToken) url.searchParams.set("pageToken", state.nextPageToken);

    const res = await fetchWithRetry(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      // Stream likely ended — drop cached state so we re-detect next time.
      chatState.delete(streamerId);
      return;
    }
    const data = await res.json();
    state.nextPageToken = data.nextPageToken;

    const commands = getEnabledCommands(streamerId);
    for (const item of data.items || []) {
      const type = item.snippet?.type;
      const author = item.authorDetails?.displayName || "someone";

      if (type === "newSponsorEvent") {
        logPlatformEvent(streamerId, "youtube", "membership", author);
        continue;
      }
      if (type === "textMessageEvent") {
        const text = item.snippet?.textMessageDetails?.messageText || "";
        const cmd = matchCommand(commands, text, "youtube");
        if (cmd) {
          const freshStreamer = getStreamer(streamerId);
          await sendYoutubeMessage(accessToken, state.liveChatId, fillTemplate(cmd.response, freshStreamer));
        }
      }
    }
  } catch (e) {
    console.error("YouTube chat poll error:", e);
  }
}

export async function sendYoutubeScheduledMessage(streamerId: number, message: string) {
  const conn = db.prepare("SELECT * FROM platform_connections WHERE streamer_id = ? AND platform = 'youtube'").get(streamerId) as any;
  if (!conn) return;
  const accessToken = await ensureYoutubeToken(conn);
  const state = chatState.get(streamerId);
  if (!accessToken || !state) return; // only announce while we know the stream is live
  const streamer = getStreamer(streamerId);
  await sendYoutubeMessage(accessToken, state.liveChatId, fillTemplate(message, streamer));
}

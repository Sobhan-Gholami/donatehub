import { fetchWithRetry } from "@/lib/fetchWithRetry";

type CacheEntry = { data: { live: boolean; viewers: number }; expires: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 3000; // short TTL: fresh enough to feel live, but shields the
                      // upstream site from being hammered by many OBS clients

function fromCache(key: string) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  return null;
}
function toCache(key: string, data: { live: boolean; viewers: number }) {
  cache.set(key, { data, expires: Date.now() + TTL_MS });
}

// Accepts a full Kick URL or just the channel slug.
export function parseKickChannel(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/kick\.com\/([^/?#]+)/i);
  return (match ? match[1] : trimmed).replace(/^@/, "");
}

// Accepts a full YouTube URL (channel, @handle, or /live link) or a bare @handle.
export function parseYoutubeChannel(input: string): string {
  return input.trim();
}

function youtubeLiveUrl(channel: string): string {
  if (channel.includes("youtube.com")) {
    const base = channel.replace(/\/live\/?$/, "").replace(/\/+$/, "");
    return `${base}/live`;
  }
  const handle = channel.startsWith("@") ? channel : `@${channel}`;
  return `https://www.youtube.com/${handle}/live`;
}

export async function getKickViewers(channelSlug: string): Promise<{ live: boolean; viewers: number }> {
  const cacheKey = `kick:${channelSlug}`;
  const cached = fromCache(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(
      `https://kick.com/api/v2/channels/${encodeURIComponent(channelSlug)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
      2,
      500
    );
    if (!res.ok) {
      const result = { live: false, viewers: 0 };
      toCache(cacheKey, result);
      return result;
    }
    const data = await res.json();
    const result = data?.livestream
      ? { live: true, viewers: data.livestream.viewer_count || 0 }
      : { live: false, viewers: 0 };
    toCache(cacheKey, result);
    return result;
  } catch {
    return { live: false, viewers: 0 };
  }
}

export async function getYoutubeViewers(channel: string): Promise<{ live: boolean; viewers: number }> {
  const cacheKey = `youtube:${channel}`;
  const cached = fromCache(cacheKey);
  if (cached) return cached;

  try {
    const url = youtubeLiveUrl(channel);
    const res = await fetchWithRetry(
      url,
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } },
      2,
      500
    );
    if (!res.ok) {
      const result = { live: false, viewers: 0 };
      toCache(cacheKey, result);
      return result;
    }
    const html = await res.text();
    // YouTube embeds live-viewer count in its page JSON as e.g.
    // "concurrentViewers":"1234" when a stream is currently live.
    const match = html.match(/"concurrentViewers":"(\d+)"/);
    const result = match ? { live: true, viewers: parseInt(match[1], 10) } : { live: false, viewers: 0 };
    toCache(cacheKey, result);
    return result;
  } catch {
    return { live: false, viewers: 0 };
  }
}

import db from "@/lib/db";
import { startKickListener, sendKickScheduledMessage } from "@/lib/bot/kick";
import { pollYoutubeChat, sendYoutubeScheduledMessage } from "@/lib/bot/youtube";

let started = false;

export function startBotManager() {
  if (started) return;
  started = true;

  // Keep Kick listeners alive for every connected streamer.
  async function ensureKickListeners() {
    const rows = db.prepare(`
      SELECT s.id FROM streamers s
      JOIN platform_connections pc ON pc.streamer_id = s.id AND pc.platform = 'kick'
      WHERE s.is_active = 1
    `).all() as any[];
    for (const r of rows) {
      try { await startKickListener(r.id); } catch (e) { console.error("startKickListener failed for", r.id, e); }
    }
  }

  // Poll YouTube live chat for every connected streamer.
  async function pollYoutube() {
    const rows = db.prepare(`
      SELECT s.id FROM streamers s
      JOIN platform_connections pc ON pc.streamer_id = s.id AND pc.platform = 'youtube'
      WHERE s.is_active = 1
    `).all() as any[];
    for (const r of rows) {
      try { await pollYoutubeChat(r.id); } catch (e) { console.error("pollYoutubeChat failed for", r.id, e); }
    }
  }

  // Fire scheduled announcements whose interval has elapsed.
  async function runSchedules() {
    const due = db.prepare(`
      SELECT * FROM scheduled_messages
      WHERE enabled = 1
        AND (last_sent_at IS NULL OR (julianday('now') - julianday(last_sent_at)) * 1440 >= interval_minutes)
    `).all() as any[];

    for (const sched of due) {
      let platforms: string[] = [];
      try { platforms = JSON.parse(sched.platforms); } catch { platforms = ["kick", "youtube"]; }

      if (platforms.includes("kick")) {
        try { await sendKickScheduledMessage(sched.streamer_id, sched.message); } catch (e) { console.error(e); }
      }
      if (platforms.includes("youtube")) {
        try { await sendYoutubeScheduledMessage(sched.streamer_id, sched.message); } catch (e) { console.error(e); }
      }
      db.prepare("UPDATE scheduled_messages SET last_sent_at = CURRENT_TIMESTAMP WHERE id = ?").run(sched.id);
    }
  }

  ensureKickListeners();
  setInterval(ensureKickListeners, 60_000); // pick up newly-connected streamers
  setInterval(pollYoutube, 10_000);
  setInterval(runSchedules, 30_000);

  console.log("[bot] manager started");
}

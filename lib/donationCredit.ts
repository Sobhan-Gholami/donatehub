import db from "@/lib/db";

// Call this anywhere a donation is settled/confirmed, instead of updating
// goal_current_toman directly — it also extends the donothon clock if the
// streamer has one running.
export function creditTomanToStreamer(streamerId: number, tomanAmount: number) {
  db.prepare("UPDATE streamers SET goal_current_toman = goal_current_toman + ? WHERE id = ?")
    .run(tomanAmount, streamerId);

  const streamer = db.prepare("SELECT clock_end_at, clock_toman_per_minute FROM streamers WHERE id = ?").get(streamerId) as any;
  if (streamer?.clock_end_at && streamer.clock_toman_per_minute > 0 && tomanAmount > 0) {
    const secondsToAdd = Math.round((tomanAmount / streamer.clock_toman_per_minute) * 60);
    db.prepare("UPDATE streamers SET clock_end_at = datetime(clock_end_at, ?) WHERE id = ?")
      .run(`+${secondsToAdd} seconds`, streamerId);
  }
}

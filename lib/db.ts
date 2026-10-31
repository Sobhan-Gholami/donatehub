import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "platform.db");

// Next.js build/dev spins up several worker processes that each import this
// module and try to open + initialize the same SQLite file at once, which can
// momentarily lock the file. Retry with backoff instead of crashing.
function sleepSync(ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    /* busy wait — fine for the few, rare retries this needs at startup */
  }
}

function withRetry<T>(fn: () => T, attempts = 25, delayMs = 100): T {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");
      if (!msg.includes("locked") && !msg.includes("busy")) throw e;
      sleepSync(delayMs);
    }
  }
  throw lastErr;
}

const rawDb = withRetry(() => new DatabaseSync(dbPath));
withRetry(() => rawDb.exec("PRAGMA busy_timeout = 5000;"));
withRetry(() => rawDb.exec("PRAGMA journal_mode = WAL;"));
withRetry(() => rawDb.exec("PRAGMA foreign_keys = ON;"));

// Thin wrapper so the rest of the codebase can keep using the
// better-sqlite3-style db.prepare(sql).run/get/all(...) API.
const db = {
  prepare(sql: string) {
    const stmt = withRetry(() => rawDb.prepare(sql));
    return {
      run: (...params: any[]) => withRetry(() => stmt.run(...params)),
      get: (...params: any[]) => withRetry(() => stmt.get(...params)),
      all: (...params: any[]) => withRetry(() => stmt.all(...params)),
    };
  },
  exec(sql: string) {
    withRetry(() => rawDb.exec(sql));
  },
};

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Platform-level collection accounts for forex & crypto donations (shared, not per-streamer)
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  forex_paypal_email TEXT,
  crypto_usdt_address TEXT,
  crypto_network TEXT DEFAULT 'TRC20',
  default_platform_fee_percent REAL DEFAULT 0
);
INSERT OR IGNORE INTO platform_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS streamers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,           -- e.g. /d/alexijo  -> public donate link
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,       -- login for streamer panel
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  goal_title TEXT,
  goal_amount_toman REAL DEFAULT 0,    -- overall goal shown as progress bar (in toman equivalent)
  goal_current_toman REAL DEFAULT 0,   -- auto-updated from confirmed donations

  -- Zarinpal (per-streamer, direct — platform is NOT a party to this money)
  zarinpal_merchant_id TEXT,

  -- Streamer's own payout account, where admin sends money after 24h settlement
  -- (used for forex/crypto settlement payouts)
  payout_bank_card TEXT,
  payout_bank_sheba TEXT,
  payout_bank_owner_name TEXT,

  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  donor_name TEXT NOT NULL,
  donor_phone TEXT,
  donor_message TEXT,

  method TEXT NOT NULL CHECK(method IN ('toman','forex','crypto')),
  currency TEXT NOT NULL,              -- IRT, USD, EUR, USDT ...
  amount REAL NOT NULL,                -- amount in the donor's chosen currency

  -- toman / zarinpal specific
  zarinpal_authority TEXT,
  zarinpal_ref_id TEXT,

  -- forex / crypto specific
  proof_reference TEXT,                -- txid or paypal txn id, filled by donor or admin
  fx_rate_at_settlement REAL,          -- filled at settlement time (streamer bears the fx risk)
  platform_fee_amount REAL DEFAULT 0,  -- deducted from streamer's payout (streamer bears the fee)

  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','settled','failed','cancelled')),
  card_number TEXT,                    -- saved for record keeping per requirement
  paid_at TEXT,
  settled_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transaction_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id INTEGER NOT NULL REFERENCES donations(id),
  event TEXT NOT NULL,                 -- created, confirmed, settled, failed, note
  detail TEXT,
  actor TEXT,                          -- 'system' | 'admin' | 'donor'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- OBS overlay widgets: one row per streamer per widget type.
CREATE TABLE IF NOT EXISTS widget_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  widget_type TEXT NOT NULL, -- 'goal' | 'donors' | 'donations' | 'alert' | 'kick_events' | 'youtube_events'
  config_json TEXT NOT NULL DEFAULT '{}',   -- colors, fonts, text templates, toggles
  volume REAL NOT NULL DEFAULT 0.5,         -- 0..1
  sound_url TEXT,                           -- custom uploaded sound (mp3/wav)
  media_url TEXT,                           -- custom uploaded image/gif/video (mainly for 'alert')
  media_type TEXT,                          -- 'image' | 'video'
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(streamer_id, widget_type)
);

-- OAuth connections to Kick/YouTube — lets the bot read chat and post as
-- the streamer, and lets us pick up follow/sub/membership events.
CREATE TABLE IF NOT EXISTS platform_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  platform TEXT NOT NULL CHECK(platform IN ('kick','youtube')),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  platform_user_id TEXT,       -- channel/user id on that platform
  platform_username TEXT,      -- display name, for the UI
  connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(streamer_id, platform)
);

-- Chat bot commands (default + up to 50 custom per streamer).
CREATE TABLE IF NOT EXISTS chat_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  trigger TEXT NOT NULL,           -- e.g. ".donate" (without platform-specific prefixes)
  response TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,    -- seeded defaults vs streamer-added custom ones
  enabled INTEGER DEFAULT 1,
  platforms TEXT NOT NULL DEFAULT '["kick","youtube"]', -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(streamer_id, trigger)
);

-- Scheduled/timed chat announcements (e.g. donate link every N minutes).
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  message TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL DEFAULT 30,
  platforms TEXT NOT NULL DEFAULT '["kick","youtube"]', -- JSON array
  enabled INTEGER DEFAULT 1,
  last_sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Follow/sub/membership events from Kick & YouTube, for the alert overlay
-- and for future stats. 'shown_at' works like the donation alert queue.
CREATE TABLE IF NOT EXISTS platform_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  streamer_id INTEGER NOT NULL REFERENCES streamers(id),
  platform TEXT NOT NULL CHECK(platform IN ('kick','youtube')),
  event_type TEXT NOT NULL,   -- 'follow' | 'sub' | 'gifted_sub' | 'membership'
  username TEXT,
  detail TEXT,                -- e.g. gift count, membership tier
  shown_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migration: add card-to-card fields for direct toman donations (donor sees
// the streamer's own card number and transfers manually, admin/streamer
// confirms afterwards). Guarded because SQLite has no "ADD COLUMN IF NOT
// EXISTS" and this may run against an already-created database.
function addColumnIfMissing(table: string, column: string, definition: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (e: any) {
    if (!String(e?.message || "").includes("duplicate column")) throw e;
  }
}
addColumnIfMissing("streamers", "toman_card_number", "TEXT");
addColumnIfMissing("streamers", "toman_card_owner_name", "TEXT");
// Tracks whether a settled donation has already been shown on the alert widget.
addColumnIfMissing("donations", "alerted_at", "TEXT");

// Live viewer-count widgets (Kick/YouTube). Admin sets the channel, streamer
// just toggles it on/off for their OBS overlay.
addColumnIfMissing("streamers", "kick_channel", "TEXT");
addColumnIfMissing("streamers", "kick_enabled", "INTEGER DEFAULT 0");
addColumnIfMissing("streamers", "youtube_channel", "TEXT");
addColumnIfMissing("streamers", "youtube_enabled", "INTEGER DEFAULT 0");

// "Donothon" countdown clock: starts at clock_initial_hours, ticks down in
// real time, and gains minutes as donations arrive (toman_per_minute rate).
addColumnIfMissing("streamers", "clock_initial_hours", "REAL DEFAULT 0");
addColumnIfMissing("streamers", "clock_toman_per_minute", "REAL DEFAULT 0");
addColumnIfMissing("streamers", "clock_color", "TEXT DEFAULT '#f2b84b'");
addColumnIfMissing("streamers", "clock_end_at", "TEXT");

// Test donations let a streamer preview alert sound/visuals without a real
// payment. They're excluded from real totals/goal progress.
addColumnIfMissing("donations", "is_test", "INTEGER DEFAULT 0");

// When the donor opts to cover the Zarinpal fee, the amount actually charged
// (and used for verify) is slightly higher than donation.amount, which stays
// as the intended/credited amount.
addColumnIfMissing("donations", "charged_amount", "REAL");

export default db;

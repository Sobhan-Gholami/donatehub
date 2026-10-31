export async function register() {
  // Fixes "fetch failed" errors on some Windows machines where Node.js tries
  // IPv6 first for outbound HTTPS requests (e.g. to api.zarinpal.com) and the
  // connection silently fails, even though the browser (which falls back to
  // IPv4 automatically) can reach the same host just fine.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");

    // On hosts without shell access (e.g. Render free tier) there's no way
    // to run scripts/create-admin.ts manually. If ADMIN_USERNAME/PASSWORD
    // are set as env vars, ensure that admin account exists on every boot.
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
      const db = (await import("@/lib/db")).default;
      const { hashPassword } = await import("@/lib/auth");
      const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(process.env.ADMIN_USERNAME);
      if (!existing) {
        db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)")
          .run(process.env.ADMIN_USERNAME, hashPassword(process.env.ADMIN_PASSWORD));
        console.log(`[bootstrap] created admin '${process.env.ADMIN_USERNAME}' from env vars`);
      }
    }

    // Chatbot feature removed — bot manager disabled.
    // const { startBotManager } = await import("@/lib/bot/manager");
    // startBotManager();
  }
}

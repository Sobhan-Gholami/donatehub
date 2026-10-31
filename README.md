# DonateHub — Donation Platform for Streamers

A multi-tenant donation platform for live streamers, built with **Next.js (App Router), TypeScript and SQLite**. Viewers donate in Toman (Zarinpal), PayPal, or USDT. Streamers get real-time OBS overlay widgets and Kick/YouTube integrations.

## Features
- **Payments**
  - Zarinpal gateway with per-streamer merchant IDs: money goes directly to the streamer, with sandbox mode for testing
  - PayPal / USDT donations with an admin confirm-and-settle workflow (exchange rate + fees)
- **OBS widgets:** donation alerts, goal bar, subathon-style countdown clock, live viewer count, platform events
- **OAuth integrations:** Kick (PKCE) and YouTube (Google OAuth), with automatic token refresh
- **Dashboards:**
  - Admin panel for streamers, settings, donations, and settlements
  - Streamer panel for widgets, goals, and connections
- **Security:** JWT sessions in httpOnly cookies, hashed passwords, and payout details hidden from donors

## Tech stack
Next.js 16 · React 19 · TypeScript · Tailwind CSS · SQLite (better-sqlite3) · JWT · OAuth 2.0 · Zarinpal API

## Getting started
```bash
npm install
cp .env.example .env.local   # fill in your values
npm run build && npm start   # http://localhost:3000
npx tsx scripts/create-admin.ts <username> <password>   # first admin
```
Set `ZARINPAL_SANDBOX=true` to test the full payment flow without real money.

## Architecture
```
app/
  api/         REST endpoints (auth, donate, widgets, admin, streamer, OAuth callbacks)
  w/[slug]/    OBS overlay pages
  d/[slug]/    public donation page
lib/           db, auth, oauth, exchange rate, retry-able fetch
```

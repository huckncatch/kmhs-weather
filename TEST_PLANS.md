# Test Plans

## Setup

**Dev server:**

- `pnpm dev` — runs Next.js on `http://localhost:3000`
- Or via the LaunchAgent: tmux session `kmhs-weather` (auto-started at login by
  `launchagents/com.local.kmhs-weather.plist`, started/restarted via `bin/start.sh`)

**Credentials (`.env.local`):**

- Copy `.env.example` to `.env.local` and fill in:
  - `AMBIENT_WEATHER_API_KEY` / `AMBIENT_WEATHER_APP_KEY` — from ambientweather.net/account (required for dashboard + backfill)
  - `PWS_WEATHER_STATION_ID` / `PWS_WEATHER_API_KEY` — optional
  - `WUNDERGROUND_PWS_ID` / `WUNDERGROUND_API_KEY` — optional
  - `COCORAHS_USERNAME` / `COCORAHS_PASSWORD` / `COCORAHS_SCRAPER_TIMEOUT_MS` — for the CoCoRaHS scraper/sync

**Seed data / fixtures:**

- SQLite DB at `data/weather.db` (gitignored) — schema auto-created on first run (`src/lib/data/db.ts`)
- Historical Ambient Weather readings: `set -a && source .env.local && set +a && npx tsx scripts/backfill-ambient.ts`
  (tsx doesn't load `.env.local` automatically — must source it first)
- CoCoRaHS history: `data/cocorahs.json`, or migrate via `npx tsx scripts/migrate-cocorahs-json.ts`

**Reset state:**

- Stop the dev server, delete `data/weather.db*` (and/or `data/cocorahs.json`), restart — tables/indexes are recreated automatically

---

## 2026-06-12 — `bin/install.sh` one-step fresh-install script

**Status:** Confirmed working (2026-06-13)

**Golden path:**

1. `~/Developer/kmhs-weather/bin/install.sh`
2. `pnpm install` runs (deps already present, so fast)
3. Since `.env.local` exists, skips provisioning and goes straight to LaunchAgent install
4. Prints "Installing LaunchAgent..." → "Starting server..." → "Done. Open http://localhost:3000"
5. Verify `~/Library/LaunchAgents/com.local.kmhs-weather.plist` matches the repo's copy (`diff`)
6. `tmux has-session -t kmhs-weather && echo running` → "running"
7. http://localhost:3000 loads the dashboard

**Edge case — missing `.env.local`:**

1. Temporarily rename `.env.local` to `.env.local.bak`
2. Re-run `bin/install.sh`
3. Expect: copies `.env.example` → `.env.local`, prints instructions to fill in credentials and re-run, exits 0 — without touching the LaunchAgent or starting anything
4. Restore `.env.local.bak` → `.env.local`

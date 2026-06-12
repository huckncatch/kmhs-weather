# TODO

## Pending

- Historical data visualization and trends
- Weather alerts and notifications
- Mobile-responsive design
- Data export functionality
- Comparison views (CoCoRaHS vs station rainfall)
- Weather statistics (monthly/yearly summaries)
- Add `bin/install.sh` (like worldpackers-hours-tracker) — self-contained fresh-install script that copies `launchagents/com.local.kmhs-weather.plist` to `~/Library/LaunchAgents/`, runs `launchctl load`, and starts the server (the LaunchAgent plist and `bin/start.sh` already exist from commit 9119f21)

## Completed

- [2026-06-11] Persist all Ambient Weather data locally as it's retrieved — auto-save/gap-fill infrastructure already existed (`src/lib/data/ambient-storage.ts`, `ambient-history-fetcher.ts`); ran the one-time backfill (`scripts/backfill-ambient.ts`), which populated `data/weather.db` with 41,162 readings covering 2026-01-19 through 2026-06-11 (the full history the Ambient Weather API has for this device). Ongoing readings continue to be saved automatically whenever the dashboard polls `/api/weather/ambient?action=latest`.

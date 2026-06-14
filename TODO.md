# TODO

## Pending

- Historical data visualization and trends
- Weather alerts and notifications
- Mobile-responsive design
- Data export functionality
- Comparison views (CoCoRaHS vs station rainfall)
- Weather statistics (monthly/yearly summaries)

## Completed

- [2026-06-11] Persist all Ambient Weather data locally as it's retrieved — auto-save/gap-fill infrastructure already existed (`src/lib/data/ambient-storage.ts`, `ambient-history-fetcher.ts`); ran the one-time backfill (`scripts/backfill-ambient.ts`), which populated `data/weather.db` with 41,162 readings covering 2026-01-19 through 2026-06-11 (the full history the Ambient Weather API has for this device). Ongoing readings continue to be saved automatically whenever the dashboard polls `/api/weather/ambient?action=latest`.
- [2026-06-12] Add `bin/install.sh` — self-contained fresh-install script (pnpm install, provision `.env.local` from `.env.example`, install/load the LaunchAgent plist, start the server). CLAUDE.md's cross-repo doc list and `~/config/NOTES.md`'s fresh-install steps updated to match. Test plan in `TEST_PLANS.md`, confirmed 2026-06-13.

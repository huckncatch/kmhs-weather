# TODO

## Pending

- Historical data visualization and trends
- Weather alerts and notifications
- Mobile-responsive design
- Data export functionality
- Comparison views (CoCoRaHS vs station rainfall)
- Weather statistics (monthly/yearly summaries)
- Test `bin/install.sh` end-to-end (see test plan from EPCT session 2026-06-12) and confirm before marking done

## Completed

- [2026-06-11] Persist all Ambient Weather data locally as it's retrieved — auto-save/gap-fill infrastructure already existed (`src/lib/data/ambient-storage.ts`, `ambient-history-fetcher.ts`); ran the one-time backfill (`scripts/backfill-ambient.ts`), which populated `data/weather.db` with 41,162 readings covering 2026-01-19 through 2026-06-11 (the full history the Ambient Weather API has for this device). Ongoing readings continue to be saved automatically whenever the dashboard polls `/api/weather/ambient?action=latest`.

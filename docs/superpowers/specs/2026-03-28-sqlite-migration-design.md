# SQLite Migration Design

**Date:** 2026-03-28
**Status:** Approved

## Problem

Weather data from Ambient Weather is only accessible via API for one year. The current
CoCoRaHS storage uses a flat JSON file. Both need durable, local, long-term storage.

## Goal

Migrate all data persistence to a local SQLite database (`data/weather.db`), preserving
all existing CoCoRaHS observations and accumulating full-resolution Ambient Weather
readings going forward — with automatic gap recovery after downtime.

## Approach

Single SQLite database with two tables, using `better-sqlite3` (no ORM). The existing
`cocorahs-storage.ts` interface is preserved exactly; only its internals change. API
routes are untouched.

---

## Dependencies

Add to `package.json` before implementation:

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

Note: `better-sqlite3` includes a native C++ addon and requires compilation at install
time. This is handled automatically by `pnpm install` as long as standard build tools
are available (Xcode Command Line Tools on macOS).

---

## Database Schema

### `cocorahs_observations`

Migrated directly from `data/cocorahs.json`. All fields preserved.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PRIMARY KEY | Preserves existing `obs-xxx` IDs |
| `date` | TEXT UNIQUE | YYYY-MM-DD |
| `rainfall` | REAL | Inches |
| `snowfall` | REAL | Nullable |
| `snowfall_new_depth` | REAL | Nullable — 24-hour new snow depth |
| `snowfall_water_content` | REAL | Nullable |
| `snowfall_slr` | REAL | Nullable |
| `snowpack_total_depth` | REAL | Nullable |
| `snowpack_water_content` | REAL | Nullable |
| `snowpack_density` | REAL | Nullable |
| `obs_time` | TEXT | Nullable |
| `station_number` | TEXT | Nullable |
| `station_name` | TEXT | Nullable |
| `state` | TEXT | Nullable |
| `county` | TEXT | Nullable |
| `notes` | TEXT | Nullable |
| `source` | TEXT | `'manual'` or `'import'` |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### `ambient_readings`

One row per ~5-minute station reading. ~105,000 rows per year at 5-minute intervals.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Auto-increment |
| `timestamp` | TEXT UNIQUE | ISO timestamp from API — deduplication key |
| `date` | TEXT | YYYY-MM-DD derived from timestamp — fast date queries |
| `temp_f` | REAL | Outdoor temperature |
| `feels_like` | REAL | Nullable |
| `temp_indoor_f` | REAL | Nullable |
| `humidity` | REAL | Nullable |
| `humidity_indoor` | REAL | Nullable |
| `wind_speed_mph` | REAL | Nullable |
| `wind_dir` | INTEGER | Degrees, nullable |
| `wind_gust_mph` | REAL | Nullable |
| `pressure_relative` | REAL | inHg, nullable |
| `pressure_absolute` | REAL | inHg, nullable |
| `daily_rain_in` | REAL | Station gauge reading |
| `uv` | REAL | Nullable |
| `solar_radiation` | REAL | Nullable |
| `battery_ok` | INTEGER | 0/1, nullable |

**Index:** `CREATE INDEX IF NOT EXISTS idx_ambient_readings_date ON ambient_readings(date)`

This index is created in `db.ts` alongside the table definition. Without it, date-range
queries scan all ~100k+ rows on every request.

---

## Code Structure

### `src/lib/data/db.ts` — New

Database singleton. Opens `data/weather.db` once at module load time, runs
`CREATE TABLE IF NOT EXISTS` for both tables, and creates the `date` index on
`ambient_readings`. All other data modules import the `db` instance from here.

If the database file cannot be opened, this module throws immediately — fail loud.

### `src/lib/data/cocorahs-storage.ts` — Internal rewrite

Same exported function signatures as today, including `async` on all functions.
`better-sqlite3` is synchronous internally, but the functions remain `async` so
all callers using `await` continue to work without changes.

Exports (unchanged):
- `getAllObservations(options?)`
- `getObservationById(id)`
- `getObservationByDate(date)`
- `createObservation(data, source?)`
- `updateObservation(id, updates)`
- `deleteObservation(id)`
- `bulkImportObservations(observations[])`

### `src/lib/data/ambient-storage.ts` — New

Three exports:
- `saveReading(data: AmbientWeatherData)` — `INSERT OR IGNORE` one reading
- `getReadings({ startDate, endDate })` — query readings for a date range
- `getLatestTimestamp()` — returns most recent saved timestamp (used for gap-fill)

### `src/app/api/weather/ambient/route.ts` — Minor update

After fetching current conditions from Ambient Weather, call `saveReading()` before
returning the response. A save failure logs the error but does not affect the response.

**Gap-fill:** A module-level boolean `gapFillAttempted` is set to `false` at module
load. On the first request where `gapFillAttempted` is `false`, check
`getLatestTimestamp()`. If it's more than 5 minutes ago, trigger a gap-fill
**fire-and-forget** (not awaited) and immediately set `gapFillAttempted = true`. This
keeps the gap-fill off the response critical path — the user gets their weather data
immediately and the gap-fill runs in the background.

The gap-fill calls `fetchAndSaveAmbientHistory(fromTimestamp, toTimestamp)` — a shared
utility function extracted into `src/lib/data/ambient-history-fetcher.ts`. This same
function is used by `scripts/backfill-ambient.ts`, avoiding duplicated fetch logic.
It calls the Ambient Weather `/devices/:macAddress` history endpoint with `dateFrom`
and `dateTo` parameters, paginates through all results, and saves each reading via
`saveReading()`.

Note: `gapFillAttempted` is per-process and resets on server restart, which is the
desired behavior — each cold start should check for gaps.

---

## Scripts (one-time, run manually)

Both scripts import `db.ts` directly, which ensures the database file and tables are
created before any inserts run. No need to start the dev server first.

### `scripts/backfill-ambient.ts`

Pulls the full year of Ambient Weather history before the access window expires.
Fetches in paginated monthly batches, saves via `saveReading()` (`INSERT OR IGNORE`
handles any overlaps with live data). Prints progress every 500 rows.

On batch failure, logs the date range and continues with the next batch — partial
results from successful batches are kept. The script is safe to re-run; already-saved
readings are silently skipped. Prints final summary: saved / skipped / failed ranges.

**Run once:** `npx tsx scripts/backfill-ambient.ts`

### `scripts/migrate-cocorahs-json.ts`

Reads `data/cocorahs.json`, inserts each observation into `cocorahs_observations`
preserving all IDs and timestamps. Uses `INSERT OR IGNORE`. Logs any failures by ID.
Prints final count: migrated / skipped / failed.

`data/cocorahs.json` is left intact as a safety net until manually deleted.

**Run once:** `npx tsx scripts/migrate-cocorahs-json.ts`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Database fails to open | App throws immediately on startup — fail loud |
| `saveReading()` fails | Log error, return weather data to dashboard normally |
| Gap-fill fetch fails | Log error, skip — retries on next cold start |
| Duplicate reading insert | Silent `INSERT OR IGNORE` — not an error |
| Backfill batch fails | Log date range, keep partial results, continue next batch |
| CoCoRaHS migration row fails | Log observation ID, continue — report at end |

---

## File Changes Summary

| File | Change |
|---|---|
| `src/lib/data/db.ts` | SQLite singleton + schema init + index |
| `src/lib/data/cocorahs-storage.ts` | **Rewrite internals** — same async interface |
| `src/lib/data/ambient-storage.ts` | `saveReading`, `getReadings`, `getLatestTimestamp` |
| `src/lib/data/ambient-history-fetcher.ts` | **New** — `fetchAndSaveAmbientHistory(from, to)`; shared by backfill script and gap-fill |
| `src/app/api/weather/ambient/route.ts` | **Minor update** — auto-save + gap-fill trigger |
| `scripts/backfill-ambient.ts` | One-time script; uses `ambient-history-fetcher` to pull full year of history |
| `scripts/migrate-cocorahs-json.ts` | One-time script; reads `cocorahs.json` and inserts all rows into SQLite |
| `data/weather.db` | SQLite database file (generated at runtime) |
| `.gitignore` | **Update** — add `data/*.db` |

---

## Out of Scope

- No changes to API route signatures
- No UI changes
- No Prisma or ORM tooling
- No deployment changes
- `data/cocorahs.json` retained as read-only backup until manually removed

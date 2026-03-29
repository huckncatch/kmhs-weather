# CoCoRaHS Web Scraper Design

**Date:** 2026-03-29
**Status:** Approved

## Problem

CoCoRaHS observations currently enter the system via manual entry or CSV import.
Both require the user to take explicit action to retrieve and upload data. Automating
retrieval from the CoCoRaHS website would eliminate this friction.

## Goal

Add an on-demand "Sync from CoCoRaHS" UI that authenticates with the CoCoRaHS website,
scrapes the user's observation history for a chosen date range, and imports the results
into the existing SQLite database — with no changes to existing storage or API routes.

## Approach

**C → B fallback**: First investigate whether CoCoRaHS exposes a direct CSV export URL
when authenticated. If so, use a lightweight HTTP client + cookie session approach (no
browser binary required). If not, use Playwright headless browser to handle ASP.NET
ViewState complexity automatically.

The scraper is a single server-side module. Credentials are stored in `.env.local` and
never leave the server.

---

## Architecture

```
[CoCoRaHS Website] ← scraper (auth + data extraction)
        ↓
[POST /api/cocorahs/sync]    ← new Next.js API route
        ↓
[bulkImportObservations()]   ← existing, unchanged
        ↓
[SQLite: weather.db]         ← existing, unchanged
        ↑
[CoCoRaHSSyncPanel]          ← new UI component on /cocorahs page
```

No changes to `cocorahs-storage.ts`, existing API routes, or type definitions.

---

## Components

### 1. Scraper Module — `src/lib/scraper/cocorahs-scraper.ts`

Single exported function:

```typescript
export async function scrapeCoCoRaHSObservations(options: {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}): Promise<CreateObservationRequest[]>
```

**Implementation path A (preferred — investigate first):**
If CoCoRaHS exposes a CSV download URL when authenticated:
1. GET login page → extract `__VIEWSTATE` / `__EVENTVALIDATION` tokens
2. POST credentials + tokens → capture session cookie
3. GET CSV export URL with session cookie
4. Parse CSV using existing `parseCoCoRaHSCsv()` + `csvToObservations()`

**Implementation path B (fallback):**
If no CSV export URL exists:
1. Launch headless Chromium via Playwright
2. Navigate to login page, fill credentials, submit
3. Navigate to "My Observations" with date range query params
4. Extract table rows, map to `CreateObservationRequest[]`
5. Close browser

Credentials are read from `process.env.COCORAHS_USERNAME` and
`process.env.COCORAHS_PASSWORD` inside the function.

Scraped records are stored with `source: 'import'` — the existing value used by
`bulkImportObservations()`. No new source type is introduced; the distinction between
a CSV import and a scrape is not currently needed in the UI.

### 2. Sync API Route — `src/app/api/cocorahs/sync/route.ts`

`POST /api/cocorahs/sync`

**Request body:**
```typescript
{
  mode: 'missing' | 'recent' | 'all' | 'range'
  days?: number      // 'recent' mode — default 30
  startDate?: string // 'range' mode — YYYY-MM-DD
  endDate?: string   // 'range' mode — YYYY-MM-DD
}
```

**Mode resolution:**
- `missing` — find all calendar dates without an observation between the earliest
  existing DB record and today. If the DB is empty, fall back to `all` mode
  (`startDate = 2000-01-01`). The scraper fetches the full resulting date range;
  the DB's `INSERT OR IGNORE` deduplication handles any overlap.
- `recent` — `endDate = today`, `startDate = today - days`
- `all` — `endDate = today`, `startDate = 2000-01-01` (CoCoRaHS program start)
- `range` — use provided `startDate` / `endDate` directly

**Response:** `CoCoRaHSApiResponse<{ imported: number; skipped: number; errors: string[] }>`

Reuses the existing `CoCoRaHSApiResponse<T>` wrapper for consistency.

### 3. Sync UI Component — `src/components/weather/CoCoRaHSSyncPanel.tsx`

Inline panel on the `/cocorahs` page (no modal). Layout:

```
[ Sync from CoCoRaHS ▼ ]   ← toggles panel open/closed

  ○ Missing dates only
  ○ Last N days  [ 30 ]
  ○ All history
  ○ Date range   [ YYYY-MM-DD ] to [ YYYY-MM-DD ]

  [ Run Sync ]
```

**States:**
- **Idle**: Options visible, "Run Sync" button enabled
- **Running**: Spinner on button, inputs disabled
- **Success**: Brief inline result ("Imported 12, skipped 3"), observations list re-fetches
- **Error**: Inline error message, inputs re-enabled

No page reload. Uses the existing data-fetching mechanism (TanStack Query or SWR) to
invalidate/refetch the observations list after a successful sync.

---

## Credentials

Add to `.env.local`:
```
COCORAHS_USERNAME=your_username
COCORAHS_PASSWORD=your_password
```

Add to `.env.example`:
```
COCORAHS_USERNAME=
COCORAHS_PASSWORD=
```

---

## Error Handling

- **Auth failure**: Return `{ success: false, error: "CoCoRaHS authentication failed" }` with HTTP 401
- **No data found**: Return success with `imported: 0, skipped: 0` (not an error)
- **Parse errors**: Collected per-row and returned in the `errors[]` array
- **Network timeout**: Wrap scraper call in a timeout; return 504 if exceeded.
  Default timeout: 30 000 ms (configurable via `COCORAHS_SCRAPER_TIMEOUT_MS` env var)
- **Missing credentials**: Return 500 with clear message if env vars not set

---

## Dependencies

**Path A (HTTP + cheerio):**
```bash
pnpm add cheerio
```

**Path B (Playwright):**
```bash
pnpm add playwright
npx playwright install chromium
```

> **Note:** Playwright requires a persistent Node.js server environment. It is
> incompatible with serverless/edge deployment (e.g. Vercel) without additional
> configuration (e.g. `@sparticuz/chromium`). This project currently targets local
> development only, so this is not a current concern.

Investigation of the CoCoRaHS website (via DevTools Network tab while manually
downloading data) determines which path to take before implementation begins.

---

## Out of Scope

- Scheduled/automatic sync (on-demand only)
- Syncing other users' stations
- Writing observations back to CoCoRaHS

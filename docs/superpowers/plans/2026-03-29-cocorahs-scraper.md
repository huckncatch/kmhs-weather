# CoCoRaHS Web Scraper Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand "Sync from CoCoRaHS" button that authenticates with the CoCoRaHS website, scrapes the user's observations for a chosen date range, and imports them into the existing SQLite database.

**Architecture:** A new scraper module (`src/lib/scraper/cocorahs-scraper.ts`) handles authentication and data extraction. A new sync API route resolves the date range from the chosen mode and calls the scraper, then passes results to the existing `bulkImportObservations()`. A new `CoCoRaHSSyncPanel` component in the UI triggers the sync and refreshes the observations list on success.

**Tech Stack:** TypeScript, Next.js App Router, better-sqlite3 (existing), cheerio (Path A) or Playwright (Path B — determined by pre-implementation investigation), Vitest (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/scraper/cocorahs-scraper.ts` | **Create** | Auth + data extraction from cocorahs.org |
| `src/lib/scraper/date-range.ts` | **Create** | Pure function: resolve sync mode → `{ startDate, endDate }` |
| `src/app/api/cocorahs/sync/route.ts` | **Create** | POST handler: validates input, calls scraper, calls bulkImport |
| `src/components/weather/CoCoRaHSSyncPanel.tsx` | **Create** | UI: mode selector, Run Sync button, result display |
| `src/app/cocorahs/page.tsx` | **Modify** | Add `<CoCoRaHSSyncPanel onSyncComplete={fetchObservations} />` |
| `.env.local` | **Modify** | Add `COCORAHS_USERNAME` / `COCORAHS_PASSWORD` |
| `.env.example` | **Modify** | Document new env vars |
| `src/lib/scraper/__tests__/date-range.test.ts` | **Create** | Unit tests for date range resolution |

---

## Chunk 1: Investigation + Scraper Module

### Task 1: Investigate CoCoRaHS site for CSV export URL

**This is a manual step — do it before writing any code.**

- [ ] **Step 1: Log into cocorahs.org in your browser**

  Navigate to your station's "My Observations" page.

- [ ] **Step 2: Open DevTools → Network tab, then click any "export" or "download" button**

  Look for a request to a URL like `/MyPage/MyObservations.aspx` or similar. Check if it returns CSV content.

- [ ] **Step 3: Record your finding**

  - **If a CSV download URL exists:** Use **Path A** (HTTP + cheerio) in Task 3.
    Install: `pnpm add cheerio`
  - **If no CSV download — data is only in the HTML table:** Use **Path B** (Playwright) in Task 3.
    Install: `pnpm add playwright && npx playwright install chromium`

- [ ] **Step 4: Install the appropriate dependency**

  Run the install command from your finding above. Verify it completes without error.

---

### Task 2: Create date range resolution module

The scraper accepts `{ startDate, endDate }`. The sync route is responsible for resolving the user's chosen mode into that pair. Extracting this as a pure function makes it testable without touching HTTP or the DB.

**Files:**
- Create: `src/lib/scraper/date-range.ts`
- Create: `src/lib/scraper/__tests__/date-range.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `src/lib/scraper/__tests__/date-range.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest'
  import { resolveDateRange } from '../date-range'

  describe('resolveDateRange', () => {
    const TODAY = '2026-03-29'

    it('all mode returns 2000-01-01 to today', () => {
      const { startDate, endDate } = resolveDateRange({ mode: 'all' }, TODAY)
      expect(startDate).toBe('2000-01-01')
      expect(endDate).toBe(TODAY)
    })

    it('recent mode with days=30 returns today-30 to today', () => {
      const { startDate, endDate } = resolveDateRange({ mode: 'recent', days: 30 }, TODAY)
      expect(startDate).toBe('2026-02-27')
      expect(endDate).toBe(TODAY)
    })

    it('recent mode defaults to 30 days', () => {
      const { startDate, endDate } = resolveDateRange({ mode: 'recent' }, TODAY)
      expect(startDate).toBe('2026-02-27')
      expect(endDate).toBe(TODAY)
    })

    it('range mode returns provided dates unchanged', () => {
      const { startDate, endDate } = resolveDateRange({
        mode: 'range',
        startDate: '2026-01-01',
        endDate: '2026-03-01',
      }, TODAY)
      expect(startDate).toBe('2026-01-01')
      expect(endDate).toBe('2026-03-01')
    })

    it('missing mode with existing observations uses earliest DB date to today', () => {
      const { startDate, endDate } = resolveDateRange(
        { mode: 'missing' },
        TODAY,
        '2025-06-01' // earliest DB observation
      )
      expect(startDate).toBe('2025-06-01')
      expect(endDate).toBe(TODAY)
    })

    it('missing mode with empty DB falls back to all mode', () => {
      const { startDate, endDate } = resolveDateRange(
        { mode: 'missing' },
        TODAY,
        null // no observations in DB
      )
      expect(startDate).toBe('2000-01-01')
      expect(endDate).toBe(TODAY)
    })

    it('throws if range mode is missing startDate', () => {
      expect(() => resolveDateRange({ mode: 'range', endDate: '2026-03-01' }, TODAY))
        .toThrow('startDate and endDate required')
    })

    it('throws if range mode is missing endDate', () => {
      expect(() => resolveDateRange({ mode: 'range', startDate: '2026-01-01' }, TODAY))
        .toThrow('startDate and endDate required')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd /Users/soob/Developer/kmhs-weather
  pnpm test src/lib/scraper/__tests__/date-range.test.ts
  ```

  Expected: all tests fail with "Cannot find module '../date-range'"

- [ ] **Step 3: Implement `src/lib/scraper/date-range.ts`**

  ```typescript
  export interface SyncRequest {
    mode: 'missing' | 'recent' | 'all' | 'range'
    days?: number
    startDate?: string
    endDate?: string
  }

  export interface DateRange {
    startDate: string
    endDate: string
  }

  /**
   * Resolve a sync mode into a concrete { startDate, endDate } range.
   *
   * @param req         - The sync request from the API
   * @param today       - Today's date as YYYY-MM-DD (injectable for testing)
   * @param earliestObs - Earliest observation date in DB, or null if DB is empty (for 'missing' mode)
   */
  export function resolveDateRange(
    req: SyncRequest,
    today: string,
    earliestObs?: string | null
  ): DateRange {
    switch (req.mode) {
      case 'all':
        return { startDate: '2000-01-01', endDate: today }

      case 'recent': {
        const days = req.days ?? 30
        const start = subtractDays(today, days)
        return { startDate: start, endDate: today }
      }

      case 'range': {
        if (!req.startDate || !req.endDate) {
          throw new Error('startDate and endDate required for range mode')
        }
        return { startDate: req.startDate, endDate: req.endDate }
      }

      case 'missing': {
        // If DB is empty, fall back to all-history range
        if (!earliestObs) return { startDate: '2000-01-01', endDate: today }
        // Otherwise scrape from earliest observation to today;
        // INSERT OR IGNORE in bulkImportObservations handles deduplication
        return { startDate: earliestObs, endDate: today }
      }
    }
  }

  /** Subtract N days from a YYYY-MM-DD string, return YYYY-MM-DD */
  function subtractDays(dateStr: string, days: number): string {
    const date = new Date(dateStr + 'T00:00:00Z')
    date.setUTCDate(date.getUTCDate() - days)
    return date.toISOString().split('T')[0]
  }
  ```

- [ ] **Step 4: Run tests to confirm they pass**

  ```bash
  pnpm test src/lib/scraper/__tests__/date-range.test.ts
  ```

  Expected: all 7 tests pass

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/scraper/date-range.ts src/lib/scraper/__tests__/date-range.test.ts
  git commit -m "feat: add CoCoRaHS sync date range resolver"
  ```

---

### Task 3A: Implement scraper — Path A (HTTP + cheerio)

**Only follow this task if your Task 1 investigation found a CSV download URL.**
If no CSV URL was found, skip to Task 3B.

**Files:**
- Create: `src/lib/scraper/cocorahs-scraper.ts`

- [ ] **Step 1: Record the CSV export URL and any required query params**

  From your DevTools investigation, note:
  - The full URL of the CSV download request
  - Any query parameters needed (date range, station ID, etc.)
  - The login form URL and field names

- [ ] **Step 2: Create `src/lib/scraper/cocorahs-scraper.ts`**

  ```typescript
  import * as cheerio from 'cheerio'
  import { parseCoCoRaHSCsv, csvToObservations } from '@/lib/utils/csv-parser'
  import type { CreateObservationRequest } from '@/types/cocorahs'

  // ── Replace these with the actual URLs/field names from your investigation ──
  const LOGIN_PAGE_URL = 'https://www.cocorahs.org/Account/LogOn.aspx'
  const LOGIN_POST_URL = 'https://www.cocorahs.org/Account/LogOn.aspx'
  const CSV_EXPORT_URL = 'https://www.cocorahs.org/MyPage/MyObservations.aspx' // adjust
  // ────────────────────────────────────────────────────────────────────────────

  export class CoCoRaHSAuthError extends Error {
    constructor() { super('CoCoRaHS authentication failed') }
  }

  /**
   * Authenticate with CoCoRaHS and return the session cookie string.
   * Reads credentials from COCORAHS_USERNAME / COCORAHS_PASSWORD env vars.
   */
  async function authenticate(): Promise<string> {
    const username = process.env.COCORAHS_USERNAME
    const password = process.env.COCORAHS_PASSWORD
    if (!username || !password) {
      throw new Error('COCORAHS_USERNAME and COCORAHS_PASSWORD must be set in .env.local')
    }

    // GET login page to extract ASP.NET ViewState tokens
    const loginPageRes = await fetch(LOGIN_PAGE_URL)
    const loginPageHtml = await loginPageRes.text()
    const $ = cheerio.load(loginPageHtml)

    const viewState = $('input[name="__VIEWSTATE"]').val() as string
    const eventValidation = $('input[name="__EVENTVALIDATION"]').val() as string
    const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val() as string

    // POST credentials
    // NOTE: field names ('UserName', 'Password') may need adjustment based on actual form
    const body = new URLSearchParams({
      __VIEWSTATE: viewState ?? '',
      __EVENTVALIDATION: eventValidation ?? '',
      __VIEWSTATEGENERATOR: viewStateGenerator ?? '',
      'ctl00$MainContent$UserName': username,
      'ctl00$MainContent$Password': password,
      'ctl00$MainContent$LoginButton': 'Log In',
    })

    const loginRes = await fetch(LOGIN_POST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    })

    // On success, CoCoRaHS redirects — collect the Set-Cookie header
    const cookies = loginRes.headers.getSetCookie?.() ?? []
    const sessionCookie = cookies.join('; ')

    if (!sessionCookie) throw new CoCoRaHSAuthError()

    // Quick sanity check: try loading the observations page
    const checkRes = await fetch(CSV_EXPORT_URL, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    })
    // If we get redirected back to login, auth failed
    if (checkRes.status === 302 && checkRes.headers.get('location')?.includes('LogOn')) {
      throw new CoCoRaHSAuthError()
    }

    return sessionCookie
  }

  /**
   * Scrape CoCoRaHS observations for the given date range.
   * Returns observations ready for bulkImportObservations().
   */
  export async function scrapeCoCoRaHSObservations(options: {
    startDate: string
    endDate: string
  }): Promise<CreateObservationRequest[]> {
    const cookie = await authenticate()

    // Build CSV export URL with date range params
    // NOTE: adjust query param names to match what you found in DevTools
    const url = new URL(CSV_EXPORT_URL)
    url.searchParams.set('startdate', options.startDate)
    url.searchParams.set('enddate', options.endDate)
    url.searchParams.set('type', 'csv') // adjust if needed

    const res = await fetch(url.toString(), {
      headers: { Cookie: cookie },
    })

    if (!res.ok) {
      throw new Error(`CoCoRaHS export request failed: ${res.status}`)
    }

    const csvContent = await res.text()
    const parsed = parseCoCoRaHSCsv(csvContent)

    if (!parsed.success || !parsed.data) {
      throw new Error(`Failed to parse CoCoRaHS CSV: ${parsed.errors?.join(', ')}`)
    }

    return csvToObservations(parsed.data)
  }
  ```

- [ ] **Step 3: Smoke test — run scraper manually**

  Create a quick throwaway script to verify login and data extraction work before building the full API route:

  ```bash
  # From project root
  node --loader ts-node/esm -e "
    process.env.COCORAHS_USERNAME = 'your_username';
    process.env.COCORAHS_PASSWORD = 'your_password';
    const { scrapeCoCoRaHSObservations } = await import('./src/lib/scraper/cocorahs-scraper.ts');
    const obs = await scrapeCoCoRaHSObservations({ startDate: '2026-03-01', endDate: '2026-03-29' });
    console.log('Got', obs.length, 'observations', obs[0]);
  "
  ```

  > If this fails, inspect the login flow more carefully in DevTools. The form field names and redirect behavior may differ from the template above — adjust the field names (`ctl00$MainContent$UserName` etc.) to match the actual form.

  Expected: logs N observations with date and rainfall fields.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/scraper/cocorahs-scraper.ts
  git commit -m "feat: add CoCoRaHS scraper (HTTP/cheerio path)"
  ```

---

### Task 3B: Implement scraper — Path B (Playwright headless browser)

**Only follow this task if your Task 1 investigation found no CSV export URL.**
If a CSV URL was found, skip this task (you already completed Task 3A).

**Files:**
- Create: `src/lib/scraper/cocorahs-scraper.ts`

- [ ] **Step 1: Note the exact CoCoRaHS URLs from your DevTools investigation**

  From your Task 1 investigation, record:
  - Login page URL
  - The "My Observations" page URL and any date filter controls
  - The HTML table structure (column order, class names)

- [ ] **Step 2: Create `src/lib/scraper/cocorahs-scraper.ts`**

  ```typescript
  import { chromium } from 'playwright'
  import type { CreateObservationRequest } from '@/types/cocorahs'

  // ── Replace with actual URLs from your investigation ──
  const LOGIN_URL = 'https://www.cocorahs.org/Account/LogOn.aspx'
  const OBSERVATIONS_URL = 'https://www.cocorahs.org/MyPage/MyObservations.aspx'
  // ─────────────────────────────────────────────────────

  export class CoCoRaHSAuthError extends Error {
    constructor() { super('CoCoRaHS authentication failed') }
  }

  /**
   * Scrape CoCoRaHS observations for the given date range using a headless browser.
   * Reads credentials from COCORAHS_USERNAME / COCORAHS_PASSWORD env vars.
   */
  export async function scrapeCoCoRaHSObservations(options: {
    startDate: string
    endDate: string
  }): Promise<CreateObservationRequest[]> {
    const username = process.env.COCORAHS_USERNAME
    const password = process.env.COCORAHS_PASSWORD
    if (!username || !password) {
      throw new Error('COCORAHS_USERNAME and COCORAHS_PASSWORD must be set in .env.local')
    }

    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()

      // Navigate to login page
      await page.goto(LOGIN_URL)

      // Fill credentials
      // NOTE: selector names may need adjustment — inspect the actual login form
      await page.fill('input[name="ctl00$MainContent$UserName"]', username)
      await page.fill('input[name="ctl00$MainContent$Password"]', password)
      await page.click('input[name="ctl00$MainContent$LoginButton"]')

      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle' })

      // Verify we're logged in (not redirected back to login)
      if (page.url().includes('LogOn')) throw new CoCoRaHSAuthError()

      // Navigate to observations page with date range
      // NOTE: query param names may need adjustment based on the actual page
      const url = new URL(OBSERVATIONS_URL)
      url.searchParams.set('startdate', options.startDate)
      url.searchParams.set('enddate', options.endDate)
      await page.goto(url.toString())
      await page.waitForLoadState('networkidle')

      // Extract table rows
      // NOTE: update the selector to match the actual observations table
      const rows = await page.$$eval('table.observations-table tbody tr', (trs) =>
        trs.map((tr) => {
          const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? '')
          return cells
        })
      )

      return parseTableRows(rows)
    } finally {
      await browser.close()
    }
  }

  /**
   * Convert raw table rows from the CoCoRaHS observations page to CreateObservationRequest[].
   * NOTE: update column indices to match the actual table structure.
   */
  function parseTableRows(rows: string[][]): CreateObservationRequest[] {
    const observations: CreateObservationRequest[] = []

    for (const cells of rows) {
      // Adjust column indices based on the actual table structure
      const dateStr = cells[0]  // e.g. "3/15/2026"
      const rainfallStr = cells[4]  // e.g. "0.45" or "T"

      if (!dateStr || !rainfallStr) continue

      // Normalize date from M/D/YYYY to YYYY-MM-DD
      const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (!dateMatch) continue
      const date = `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`

      // Parse rainfall (handle trace amounts)
      let rainfall: number
      if (rainfallStr === 'T') {
        rainfall = 0.01
      } else {
        rainfall = parseFloat(rainfallStr)
        if (isNaN(rainfall) || rainfall < 0) continue
      }

      observations.push({ date, rainfall })
    }

    // NOTE: Path B only captures date and rainfall from the HTML table.
    // Extended fields (snowfall, obsTime, stationNumber, etc.) are not available
    // without a CSV export. Path A (HTTP + CSV) returns richer data if available.
    return observations
  }
  ```

- [ ] **Step 3: Smoke test with headless: false to watch the browser**

  Temporarily set `headless: false` in the launch call, then run:

  ```bash
  node --loader ts-node/esm -e "
    process.env.COCORAHS_USERNAME = 'your_username';
    process.env.COCORAHS_PASSWORD = 'your_password';
    const { scrapeCoCoRaHSObservations } = await import('./src/lib/scraper/cocorahs-scraper.ts');
    const obs = await scrapeCoCoRaHSObservations({ startDate: '2026-03-01', endDate: '2026-03-29' });
    console.log('Got', obs.length, 'observations', obs[0]);
  "
  ```

  Watch the browser navigate. If login fails or the table isn't found, adjust selector names in the scraper to match what you see.

  Once working, set `headless: true` again.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/scraper/cocorahs-scraper.ts
  git commit -m "feat: add CoCoRaHS scraper (Playwright path)"
  ```

---

## Chunk 2: Sync API Route

### Task 4: Implement `POST /api/cocorahs/sync`

**Files:**
- Create: `src/app/api/cocorahs/sync/route.ts`

- [ ] **Step 1: Add credentials to `.env.local` and `.env.example`**

  In `.env.local` (never committed), add:
  ```
  COCORAHS_USERNAME=your_actual_username
  COCORAHS_PASSWORD=your_actual_password
  ```

  In `.env.example`, replace the existing CoCoRaHS comment block with:
  ```
  # CoCoRaHS web scraper credentials
  COCORAHS_USERNAME=
  COCORAHS_PASSWORD=
  COCORAHS_SCRAPER_TIMEOUT_MS=30000
  ```

- [ ] **Step 2: Create `src/app/api/cocorahs/sync/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { scrapeCoCoRaHSObservations, CoCoRaHSAuthError } from '@/lib/scraper/cocorahs-scraper'
  import { bulkImportObservations, getAllObservations } from '@/lib/data/cocorahs-storage'
  import { resolveDateRange } from '@/lib/scraper/date-range'
  import type { SyncRequest } from '@/lib/scraper/date-range'
  import type { CoCoRaHSApiResponse } from '@/types/cocorahs'

  interface SyncResult {
    imported: number
    skipped: number
    errors: string[]
  }

  export async function POST(request: NextRequest) {
    try {
      const body: SyncRequest = await request.json()

      if (!body.mode || !['missing', 'recent', 'all', 'range'].includes(body.mode)) {
        const res: CoCoRaHSApiResponse<never> = {
          success: false,
          error: 'Invalid or missing mode. Must be one of: missing, recent, all, range',
        }
        return NextResponse.json(res, { status: 400 })
      }

      // For 'missing' mode, look up the earliest observation in the DB
      let earliestObs: string | null = null
      if (body.mode === 'missing') {
        const all = await getAllObservations()
        if (all.length > 0) {
          earliestObs = all.reduce((min, obs) => obs.date < min ? obs.date : min, all[0].date)
        }
      }

      const today = new Date().toISOString().split('T')[0]
      let dateRange
      try {
        dateRange = resolveDateRange(body, today, earliestObs)
      } catch (err) {
        const res: CoCoRaHSApiResponse<never> = {
          success: false,
          error: err instanceof Error ? err.message : 'Invalid request',
        }
        return NextResponse.json(res, { status: 400 })
      }

      // Scrape with timeout
      const timeoutMs = parseInt(process.env.COCORAHS_SCRAPER_TIMEOUT_MS ?? '30000', 10)
      const scrapePromise = scrapeCoCoRaHSObservations(dateRange)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Scraper timed out')), timeoutMs)
      )

      const observations = await Promise.race([scrapePromise, timeoutPromise])
      const result = await bulkImportObservations(observations)

      const res: CoCoRaHSApiResponse<SyncResult> = {
        success: true,
        data: result,
        message: `Imported ${result.imported} observations. ${result.skipped} already existed.`,
      }
      return NextResponse.json(res)

    } catch (err) {
      console.error('POST /api/cocorahs/sync error:', err)

      if (err instanceof CoCoRaHSAuthError) {
        const res: CoCoRaHSApiResponse<never> = { success: false, error: err.message }
        return NextResponse.json(res, { status: 401 })
      }

      if (err instanceof Error && err.message === 'Scraper timed out') {
        const res: CoCoRaHSApiResponse<never> = { success: false, error: 'Sync timed out — try a shorter date range' }
        return NextResponse.json(res, { status: 504 })
      }

      if (err instanceof Error && err.message.includes('must be set in .env.local')) {
        const res: CoCoRaHSApiResponse<never> = { success: false, error: err.message }
        return NextResponse.json(res, { status: 500 })
      }

      const res: CoCoRaHSApiResponse<never> = {
        success: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }
      return NextResponse.json(res, { status: 500 })
    }
  }
  ```

- [ ] **Step 3: Manual test — run the sync route via curl**

  With the dev server running (`pnpm dev`), test each mode:

  ```bash
  # Test 'recent' mode (safe — short date range)
  curl -X POST http://localhost:3000/api/cocorahs/sync \
    -H "Content-Type: application/json" \
    -d '{"mode":"recent","days":7}' | jq .
  ```

  Expected: `{ "success": true, "data": { "imported": N, "skipped": N, "errors": [] } }`

  ```bash
  # Test missing credentials error
  curl -X POST http://localhost:3000/api/cocorahs/sync \
    -H "Content-Type: application/json" \
    -d '{"mode":"all"}' | jq .
  ```

  Expected (if .env.local not set): `{ "success": false, "error": "COCORAHS_USERNAME and COCORAHS_PASSWORD must be set in .env.local" }`

  ```bash
  # Test invalid mode
  curl -X POST http://localhost:3000/api/cocorahs/sync \
    -H "Content-Type: application/json" \
    -d '{"mode":"invalid"}' | jq .
  ```

  Expected: `{ "success": false, "error": "Invalid or missing mode..." }` with status 400

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/cocorahs/sync/route.ts .env.example
  git commit -m "feat: add POST /api/cocorahs/sync route"
  ```

---

## Chunk 3: UI Component + Wiring

### Task 5: Create `CoCoRaHSSyncPanel` component

**Files:**
- Create: `src/components/weather/CoCoRaHSSyncPanel.tsx`

- [ ] **Step 1: Create `src/components/weather/CoCoRaHSSyncPanel.tsx`**

  ```typescript
  'use client'

  import { useState } from 'react'
  import type { CoCoRaHSApiResponse } from '@/types/cocorahs'

  type SyncMode = 'missing' | 'recent' | 'all' | 'range'

  interface SyncResult {
    imported: number
    skipped: number
    errors: string[]
  }

  interface CoCoRaHSSyncPanelProps {
    onSyncComplete: () => void
  }

  export function CoCoRaHSSyncPanel({ onSyncComplete }: CoCoRaHSSyncPanelProps) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<SyncMode>('recent')
    const [days, setDays] = useState(30)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [syncing, setSyncing] = useState(false)
    const [result, setResult] = useState<SyncResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSync = async () => {
      setSyncing(true)
      setResult(null)
      setError(null)

      const body: Record<string, unknown> = { mode }
      if (mode === 'recent') body.days = days
      if (mode === 'range') { body.startDate = startDate; body.endDate = endDate }

      try {
        const res = await fetch('/api/cocorahs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data: CoCoRaHSApiResponse<SyncResult> = await res.json()

        if (data.success && data.data) {
          setResult(data.data)
          onSyncComplete()
        } else {
          setError(data.error ?? 'Sync failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      } finally {
        setSyncing(false)
      }
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Sync from CoCoRaHS
          <span className="text-sm font-normal text-gray-500">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            {/* Mode selector */}
            <div className="space-y-2">
              {(['missing', 'recent', 'all', 'range'] as SyncMode[]).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sync-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    disabled={syncing}
                  />
                  <span className="text-sm">
                    {m === 'missing' && 'Missing dates only'}
                    {m === 'recent' && (
                      <span className="flex items-center gap-2">
                        Last
                        <input
                          type="number"
                          min={1}
                          value={days}
                          onChange={(e) => setDays(parseInt(e.target.value) || 30)}
                          disabled={syncing || mode !== 'recent'}
                          className="w-16 px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                        />
                        days
                      </span>
                    )}
                    {m === 'all' && 'All history (since 2000-01-01)'}
                    {m === 'range' && (
                      <span className="flex items-center gap-2">
                        Date range
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          disabled={syncing || mode !== 'range'}
                          className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                        />
                        to
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          disabled={syncing || mode !== 'range'}
                          className="px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 disabled:opacity-50"
                        />
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {/* Run button */}
            <button
              onClick={handleSync}
              disabled={syncing || (mode === 'range' && (!startDate || !endDate))}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {syncing && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {syncing ? 'Syncing…' : 'Run Sync'}
            </button>

            {/* Result */}
            {result && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-900 dark:text-green-100">
                Imported {result.imported}, skipped {result.skipped}
                {result.errors.length > 0 && (
                  <div className="mt-1 text-yellow-700 dark:text-yellow-300">
                    {result.errors.length} error(s): {result.errors[0]}
                    {result.errors.length > 1 && ` (+${result.errors.length - 1} more)`}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-900 dark:text-red-100">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/components/weather/CoCoRaHSSyncPanel.tsx
  git commit -m "feat: add CoCoRaHSSyncPanel UI component"
  ```

---

### Task 6: Wire SyncPanel into the `/cocorahs` page

**Files:**
- Modify: `src/app/cocorahs/page.tsx`

- [ ] **Step 1: Add the import and the panel to the page**

  At the top of `src/app/cocorahs/page.tsx`, add the import after the existing imports:

  ```typescript
  import { CoCoRaHSSyncPanel } from '@/components/weather/CoCoRaHSSyncPanel'
  ```

  In the JSX, add the panel between the CSV Import section and the Observations List section. Find the closing `</div>` of the CSV Import card (the one with `lg:col-span-2`), and add after it:

  ```tsx
  {/* Sync from CoCoRaHS */}
  <div className="lg:col-span-2">
    <CoCoRaHSSyncPanel onSyncComplete={fetchObservations} />
  </div>
  ```

- [ ] **Step 2: Verify the page builds without TypeScript errors**

  ```bash
  cd /Users/soob/Developer/kmhs-weather
  pnpm type-check
  ```

  Expected: no errors

- [ ] **Step 3: Manual end-to-end test**

  With `pnpm dev` running:
  1. Open `http://localhost:3000/cocorahs`
  2. Click "Sync from CoCoRaHS ▼" — panel should expand
  3. Select "Last N days", set 7 days, click "Run Sync"
  4. Verify spinner appears during sync
  5. Verify result shows "Imported N, skipped N" on completion
  6. Verify the observations list updates without page reload

- [ ] **Step 4: Run full test suite**

  ```bash
  pnpm test
  ```

  Expected: all tests pass

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/cocorahs/page.tsx
  git commit -m "feat: add CoCoRaHS sync panel to observations page"
  ```

---

## Done

All four pieces are implemented:
- `src/lib/scraper/date-range.ts` — tested, pure date range logic
- `src/lib/scraper/cocorahs-scraper.ts` — auth + scraping (Path A or B)
- `src/app/api/cocorahs/sync/route.ts` — sync API route with all four modes
- `src/components/weather/CoCoRaHSSyncPanel.tsx` — UI wired to the page

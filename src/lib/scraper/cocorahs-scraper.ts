import { chromium } from 'playwright'
import type { CreateObservationRequest } from '@/types/cocorahs'

// ── Replace with actual URLs from your investigation ──
const LOGIN_URL = 'https://www.cocorahs.org/Account/LogOn.aspx'
const OBSERVATIONS_URL = 'https://www.cocorahs.org/MyPage/MyObservations.aspx'
// ─────────────────────────────────────────────────────

export class CoCoRaHSAuthError extends Error {
  constructor() {
    super('CoCoRaHS authentication failed')
    this.name = 'CoCoRaHSAuthError'
  }
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

    // Click login and wait for navigation to settle
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('input[name="ctl00$MainContent$LoginButton"]'),
    ])

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
        const cells = Array.from(tr.querySelectorAll('td')).map(
          (td) => td.textContent?.trim() ?? '',
        )
        return cells
      }),
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
    const dateStr = cells[0] // e.g. "3/15/2026"
    const rainfallStr = cells[4] // e.g. "0.45" or "T"

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

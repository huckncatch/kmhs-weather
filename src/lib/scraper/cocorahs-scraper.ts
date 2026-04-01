import { chromium, type Page } from 'playwright'
import type { CreateObservationRequest } from '@/types/cocorahs'

const LOGIN_URL = 'https://www.cocorahs.org/Login.aspx'
const OBSERVATIONS_URL =
  'https://www.cocorahs.org/Admin/MyDataEntry/ListDailyPrecipReports.aspx'

export class CoCoRaHSAuthError extends Error {
  constructor() {
    super('CoCoRaHS authentication failed')
    this.name = 'CoCoRaHSAuthError'
  }
}

/**
 * Scrape CoCoRaHS observations for the given date range using a headless browser.
 * Reads credentials from COCORAHS_USERNAME / COCORAHS_PASSWORD env vars.
 *
 * The observations page has no server-side date filter — all records are returned
 * paginated. We scrape every page and filter by date range in memory.
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

    // Navigate to login page and authenticate
    await page.goto(LOGIN_URL)
    await page.fill('input[name="txtUsername"]', username)
    await page.fill('input[name="txtPassword"]', password)
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('input[name="btnLogin"]'),
    ])

    if (page.url().includes('Login.aspx')) throw new CoCoRaHSAuthError()

    // Navigate to the observations list
    await page.goto(OBSERVATIONS_URL)
    await page.waitForLoadState('networkidle')

    // Scrape all paginated pages and collect every row
    const allRows = await scrapeAllPages(page)

    if (allRows.length === 0) {
      throw new Error(
        'No observation rows found — the page structure may have changed',
      )
    }

    return parseTableRows(allRows, options.startDate, options.endDate)
  } finally {
    await browser.close()
  }
}

/**
 * Collect data rows from every page of the observations table.
 * The page uses a numeric page-picker <select> to navigate between pages.
 */
async function scrapeAllPages(page: Page): Promise<string[][]> {
  const allRows: string[][] = []

  const scrapeCurrentPage = async (): Promise<string[][]> => {
    const rows = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() ?? ''),
      ),
    )
    // Keep only rows whose first cell is a date (M/D/YYYY) — skips header/footer rows
    return rows.filter(
      (cells) => cells.length >= 5 && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cells[0]),
    )
  }

  allRows.push(...(await scrapeCurrentPage()))

  // Look for a page-picker <select> whose options are all numeric page numbers
  const pickerInfo = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')) as HTMLSelectElement[]
    for (const sel of selects) {
      const opts = Array.from(sel.options)
      if (opts.length > 1 && opts.every((o) => /^\d+$/.test(o.text.trim()))) {
        return { id: sel.id, name: sel.name, count: opts.length }
      }
    }
    return null
  })

  if (pickerInfo && pickerInfo.count > 1) {
    const selector = pickerInfo.id
      ? `#${pickerInfo.id}`
      : `select[name="${pickerInfo.name}"]`

    for (let p = 2; p <= pickerInfo.count; p++) {
      // Register the navigation listener BEFORE triggering the postback so we
      // don't miss it (selectOption fires onchange synchronously in WebForms)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.selectOption(selector, { index: p - 1 }),
      ])
      allRows.push(...(await scrapeCurrentPage()))
    }
  }

  return allRows
}

/**
 * Convert raw table rows to CreateObservationRequest[], filtered to [startDate, endDate].
 *
 * Column layout (confirmed from live site):
 *   0  Obs Date (M/D/YYYY)
 *   1  Obs Time
 *   2  Station Number
 *   3  Station Name
 *   4  Gauge Catch in.   ← rainfall
 *   5  24hr Snowfall (snow) in
 *   6  24hr Snowfall (water) in
 *   7  SLR
 *   8  Snowpack (snow) in
 *   9  Snowpack (water) in
 *  10  Density
 *  11  Notes
 *  12  State
 *  13  County
 *  14  Actions
 *  15  Maps
 */
function parseTableRows(
  rows: string[][],
  startDate: string,
  endDate: string,
): CreateObservationRequest[] {
  const observations: CreateObservationRequest[] = []

  for (const cells of rows) {
    const dateStr = cells[0] // e.g. "3/15/2026"
    const rainfallStr = cells[4] // e.g. "0.45" or "T"

    if (!dateStr || !rainfallStr) continue

    // Normalize date from M/D/YYYY to YYYY-MM-DD, then advance by one day.
    // CoCoRaHS "Obs Date" is the start of the 24-hour accumulation period; we
    // store the end date (when the observer took the measurement) instead.
    const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!dateMatch) continue
    const rawDate = `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
    const date = addOneDay(rawDate)

    // Filter to requested date range
    if (date < startDate || date > endDate) continue

    // Parse rainfall — "T" = trace amount (stored as 0.01 in; isTrace distinguishes it)
    let rainfall: number
    let isTrace = false
    if (rainfallStr.toUpperCase() === 'T') {
      rainfall = 0.01
      isTrace = true
    } else {
      rainfall = parseFloat(rainfallStr)
      if (isNaN(rainfall) || rainfall < 0) continue
    }

    observations.push({ date, rainfall, isTrace })
  }

  return observations
}

/** Advance a YYYY-MM-DD string by one day using UTC arithmetic */
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

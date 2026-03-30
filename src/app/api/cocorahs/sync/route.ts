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

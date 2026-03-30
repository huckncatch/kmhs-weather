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
        throw new Error('startDate and endDate required')
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

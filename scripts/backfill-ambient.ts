/**
 * One-time backfill: pulls the full year of Ambient Weather history into SQLite.
 *
 * Run: npx tsx scripts/backfill-ambient.ts
 *
 * Safe to re-run — duplicate readings are silently skipped.
 * Takes ~6–10 minutes to complete (365 API requests, rate-limited to 1/sec).
 */

// Import db first to ensure tables are created
import '../src/lib/data/db'

import { validateApiCredentials, getDevices } from '../src/lib/api/ambient'
import { fetchAndSaveAmbientHistory } from '../src/lib/data/ambient-history-fetcher'

async function backfill() {
  const credentials = validateApiCredentials()

  console.log('Fetching device list...')
  const devices = await getDevices(credentials)

  if (devices.length === 0) {
    console.error('No devices found. Check your API credentials in .env.local.')
    process.exit(1)
  }

  const device = devices[0]
  console.log(`Device: ${device.info.name} (${device.macAddress})`)

  const toMs = Date.now()
  const fromMs = toMs - 365 * 24 * 60 * 60 * 1000 // 1 year ago
  const fromDate = new Date(fromMs).toISOString().split('T')[0]
  const toDate = new Date(toMs).toISOString().split('T')[0]

  console.log(`Fetching history from ${fromDate} to ${toDate}...`)
  console.log('(This takes ~6-10 minutes due to API rate limiting — 1 request/sec)\n')

  const { saved, skipped } = await fetchAndSaveAmbientHistory(
    fromMs,
    toMs,
    { ...credentials, macAddress: device.macAddress },
    (count) => console.log(`  Progress: ${count} readings saved...`)
  )

  console.log(`\nBackfill complete:`)
  console.log(`  ✓ ${saved} readings saved`)
  console.log(`  - ${skipped} skipped (already in database)`)
}

backfill().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})

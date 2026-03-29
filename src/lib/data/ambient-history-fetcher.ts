import { getDeviceData } from '@/lib/api/ambient'
import { saveReading } from './ambient-storage'

const BATCH_SIZE = 288
const RATE_LIMIT_DELAY_MS = 1100 // 1 request/second per API key

/**
 * Fetch Ambient Weather history between two epoch-ms timestamps and save to DB.
 * Paginates backwards through time using the API's endDate parameter.
 * Safe to call multiple times — duplicates are silently skipped.
 *
 * @param fromMs       Start of range (epoch ms, inclusive)
 * @param toMs         End of range (epoch ms, inclusive)
 * @param credentials  API keys + macAddress
 * @param onProgress   Optional callback called every 500 readings saved
 */
export async function fetchAndSaveAmbientHistory(
  fromMs: number,
  toMs: number,
  credentials: { apiKey: string; applicationKey: string; macAddress: string },
  onProgress?: (saved: number) => void
): Promise<{ saved: number; skipped: number }> {
  let saved = 0
  let skipped = 0
  let endDate = toMs
  let firstBatch = true

  while (true) {
    if (!firstBatch) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
    }
    firstBatch = false

    let batch: Awaited<ReturnType<typeof getDeviceData>>
    try {
      batch = await getDeviceData({
        apiKey: credentials.apiKey,
        applicationKey: credentials.applicationKey,
        macAddress: credentials.macAddress,
        endDate,
        limit: BATCH_SIZE,
      })
    } catch (err) {
      const batchEnd = new Date(endDate).toISOString().split('T')[0]
      const batchStart = new Date(endDate - BATCH_SIZE * 5 * 60 * 1000).toISOString().split('T')[0]
      console.error(`[ambient-history-fetcher] Batch failed (${batchStart}–${batchEnd}):`, err)
      // Advance cursor past this batch window and continue
      endDate = endDate - BATCH_SIZE * 5 * 60 * 1000 - 1
      if (endDate < fromMs) break
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
      continue
    }

    if (batch.length === 0) break

    for (const reading of batch) {
      if (reading.dateutc < fromMs) {
        // Passed the start boundary — done
        return { saved, skipped }
      }

      const inserted = saveReading(reading)
      if (inserted) {
        saved++
        if (onProgress && saved % 500 === 0) onProgress(saved)
      } else {
        skipped++
      }
    }

    // Advance cursor to just before the oldest reading in this batch
    const oldestDatutc = batch[batch.length - 1].dateutc
    if (oldestDatutc <= fromMs) break

    endDate = oldestDatutc - 1
  }

  return { saved, skipped }
}

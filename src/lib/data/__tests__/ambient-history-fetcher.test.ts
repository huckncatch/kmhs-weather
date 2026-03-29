import { describe, it, expect, vi, beforeEach } from 'vitest'
import db from '../db'

// Mock the Ambient Weather API client — we don't want real HTTP calls in tests
vi.mock('@/lib/api/ambient', () => ({
  getDeviceData: vi.fn(),
}))

// Import after mocking
import { getDeviceData } from '@/lib/api/ambient'
import { fetchAndSaveAmbientHistory } from '../ambient-history-fetcher'

const mockGetDeviceData = vi.mocked(getDeviceData)

const CREDENTIALS = {
  apiKey: 'test-api-key',
  applicationKey: 'test-app-key',
  macAddress: 'AA:BB:CC:DD:EE:FF',
}

function makeApiReading(dateutc: number) {
  return {
    dateutc,
    date: new Date(dateutc).toISOString(),
    tz: 'America/Los_Angeles',
    tempf: 55,
    humidity: 70,
    windspeedmph: 2,
    winddir: 270,
    dailyrainin: 0,
  }
}

beforeEach(() => {
  db.exec('DELETE FROM ambient_readings')
  vi.clearAllMocks()
})

describe('fetchAndSaveAmbientHistory', () => {
  it('fetches one batch and saves all readings within range', async () => {
    const t1 = 1743120000000 // 2025-03-28T00:00Z
    const t2 = 1743123600000 // 2025-03-28T01:00Z

    mockGetDeviceData.mockResolvedValueOnce([makeApiReading(t2), makeApiReading(t1)])

    const result = await fetchAndSaveAmbientHistory(t1, t2, CREDENTIALS)

    expect(result.saved).toBe(2)
    expect(result.skipped).toBe(0)
    const count = (db.prepare('SELECT COUNT(*) as n FROM ambient_readings').get() as { n: number }).n
    expect(count).toBe(2)
  })

  it('stops when a reading is older than fromMs', async () => {
    const from = 1743120000000
    const to   = 1743127200000
    const old  = from - 1000 // just before fromMs

    mockGetDeviceData.mockResolvedValueOnce([
      makeApiReading(to),
      makeApiReading(old), // should stop here — older than fromMs
    ])

    const result = await fetchAndSaveAmbientHistory(from, to, CREDENTIALS)

    expect(result.saved).toBe(1)
    const count = (db.prepare('SELECT COUNT(*) as n FROM ambient_readings').get() as { n: number }).n
    expect(count).toBe(1)
  })

  it('counts duplicates as skipped', async () => {
    const t1 = 1743120000000
    mockGetDeviceData.mockResolvedValue([makeApiReading(t1)])

    // First call saves it
    await fetchAndSaveAmbientHistory(t1, t1 + 1000, CREDENTIALS)
    // Second call: same reading, should be skipped
    const result = await fetchAndSaveAmbientHistory(t1, t1 + 1000, CREDENTIALS)

    expect(result.skipped).toBe(1)
    expect(result.saved).toBe(0)
  })

  it('stops fetching when API returns empty batch', async () => {
    mockGetDeviceData.mockResolvedValueOnce([])

    const result = await fetchAndSaveAmbientHistory(
      Date.now() - 86400000,
      Date.now(),
      CREDENTIALS
    )

    expect(result.saved).toBe(0)
    expect(mockGetDeviceData).toHaveBeenCalledTimes(1)
  })

  it('calls onProgress callback every 500 readings', async () => {
    const base = 1743120000000
    const readings = Array.from({ length: 501 }, (_, i) =>
      makeApiReading(base + i * 300000) // 5 min apart
    ).reverse() // newest first (as API returns them)

    mockGetDeviceData
      .mockResolvedValueOnce(readings.slice(0, 288))
      .mockResolvedValueOnce(readings.slice(288))

    const onProgress = vi.fn()
    await fetchAndSaveAmbientHistory(base, base + 501 * 300000, CREDENTIALS, onProgress)

    expect(onProgress).toHaveBeenCalledWith(500)
  })
})

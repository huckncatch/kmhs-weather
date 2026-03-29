import { describe, it, expect, beforeEach } from 'vitest'
import db from '../db'
import { saveReading, getReadings, getLatestTimestamp } from '../ambient-storage'
import type { AmbientWeatherData } from '@/types/ambient-weather'

function makeReading(overrides: Partial<AmbientWeatherData> = {}): AmbientWeatherData {
  return {
    dateutc: 1743120000000, // 2025-03-28T00:00:00.000Z
    date: '2025-03-28T00:00:00.000Z',
    tz: 'America/Los_Angeles',
    tempf: 55.4,
    humidity: 72,
    windspeedmph: 3.1,
    winddir: 180,
    dailyrainin: 0.12,
    ...overrides,
  }
}

beforeEach(() => {
  db.exec('DELETE FROM ambient_readings')
})

describe('saveReading', () => {
  it('saves a reading and returns true', () => {
    const saved = saveReading(makeReading())
    expect(saved).toBe(true)
  })

  it('returns false for a duplicate timestamp', () => {
    saveReading(makeReading())
    const saved = saveReading(makeReading()) // same dateutc
    expect(saved).toBe(false)
  })

  it('stores all mapped fields', () => {
    saveReading(makeReading({ tempf: 62.3, humidity: 55, windspeedmph: 8.2 }))
    const rows = db.prepare('SELECT * FROM ambient_readings').all() as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0].temp_f).toBe(62.3)
    expect(rows[0].humidity).toBe(55)
    expect(rows[0].wind_speed_mph).toBe(8.2)
  })

  it('derives the date column from dateutc', () => {
    saveReading(makeReading({ dateutc: 1743120000000 })) // 2025-03-28
    const row = db.prepare('SELECT date FROM ambient_readings').get() as { date: string }
    expect(row.date).toBe('2025-03-28')
  })
})

describe('getLatestTimestamp', () => {
  it('returns null when no readings exist', () => {
    expect(getLatestTimestamp()).toBeNull()
  })

  it('returns the most recent timestamp', () => {
    saveReading(makeReading({ dateutc: 1743120000000 })) // earlier
    saveReading(makeReading({ dateutc: 1743123600000 })) // later
    const ts = getLatestTimestamp()
    expect(ts).toBe(new Date(1743123600000).toISOString())
  })
})

describe('getReadings', () => {
  it('returns readings within date range', () => {
    saveReading(makeReading({ dateutc: new Date('2025-03-27').getTime() }))
    saveReading(makeReading({ dateutc: new Date('2025-03-28').getTime() }))
    saveReading(makeReading({ dateutc: new Date('2025-03-29').getTime() }))

    const results = getReadings({ startDate: '2025-03-28', endDate: '2025-03-28' })
    expect(results).toHaveLength(1)
    expect(results[0].date).toBe('2025-03-28')
  })

  it('returns empty array when no readings in range', () => {
    const results = getReadings({ startDate: '2020-01-01', endDate: '2020-01-31' })
    expect(results).toHaveLength(0)
  })
})

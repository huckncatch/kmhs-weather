import db from './db'
import type { AmbientWeatherData } from '@/types/ambient-weather'

export interface AmbientReadingRow {
  id: number
  timestamp: string
  date: string
  temp_f: number | null
  feels_like: number | null
  temp_indoor_f: number | null
  humidity: number | null
  humidity_indoor: number | null
  wind_speed_mph: number | null
  wind_dir: number | null
  wind_gust_mph: number | null
  pressure_relative: number | null
  pressure_absolute: number | null
  daily_rain_in: number | null
  uv: number | null
  solar_radiation: number | null
  battery_ok: number | null
}

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO ambient_readings (
    timestamp, date, temp_f, feels_like, temp_indoor_f,
    humidity, humidity_indoor, wind_speed_mph, wind_dir, wind_gust_mph,
    pressure_relative, pressure_absolute, daily_rain_in, uv, solar_radiation, battery_ok
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

/**
 * Save one Ambient Weather reading to the database.
 * Returns true if inserted, false if duplicate (already saved).
 */
export function saveReading(data: AmbientWeatherData): boolean {
  const timestamp = new Date(data.dateutc).toISOString()
  const date = timestamp.split('T')[0]

  const result = insertStmt.run(
    timestamp,
    date,
    data.tempf ?? null,
    data.feelsLike ?? null,
    data.tempinf ?? null,
    data.humidity ?? null,
    data.humidityin ?? null,
    data.windspeedmph ?? null,
    data.winddir ?? null,
    data.windgustmph ?? null,
    data.baromrelin ?? null,
    data.baromabsin ?? null,
    data.dailyrainin ?? null,
    data.uv ?? null,
    data.solarradiation ?? null,
    data.battout !== undefined ? (data.battout > 0 ? 1 : 0) : null
  )

  return result.changes > 0
}

/**
 * Get the ISO timestamp of the most recently saved reading.
 * Returns null if no readings exist.
 */
export function getLatestTimestamp(): string | null {
  const row = db
    .prepare('SELECT timestamp FROM ambient_readings ORDER BY timestamp DESC LIMIT 1')
    .get() as { timestamp: string } | undefined
  return row?.timestamp ?? null
}

/**
 * Get all readings for a date range (inclusive).
 * @param startDate YYYY-MM-DD
 * @param endDate   YYYY-MM-DD
 */
export function getReadings(options: {
  startDate: string
  endDate: string
}): AmbientReadingRow[] {
  return db
    .prepare(
      'SELECT * FROM ambient_readings WHERE date >= ? AND date <= ? ORDER BY timestamp ASC'
    )
    .all(options.startDate, options.endDate) as AmbientReadingRow[]
}

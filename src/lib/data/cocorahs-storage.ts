/**
 * CoCoRaHS Data Storage Service
 * Handles persistence of rainfall observations to SQLite database
 *
 * This is the data access layer — all API routes use these functions unchanged.
 */

import db from './db'
import type {
  CoCoRaHSObservation,
  CreateObservationRequest,
  UpdateObservationRequest,
} from '@/types/cocorahs'

function generateId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

type RawRow = Record<string, unknown>

function rowToObservation(row: RawRow): CoCoRaHSObservation {
  return {
    id: row.id as string,
    date: row.date as string,
    rainfall: row.rainfall as number,
    ...(row.is_trace ? { isTrace: true } : {}),
    ...(row.snowfall !== null && { snowfall: row.snowfall as number }),
    ...(row.snowfall_new_depth !== null && { snowfallNewDepth: row.snowfall_new_depth as number }),
    ...(row.snowfall_water_content !== null && { snowfallWaterContent: row.snowfall_water_content as number }),
    ...(row.snowfall_slr !== null && { snowfallSLR: row.snowfall_slr as number }),
    ...(row.snowpack_total_depth !== null && { snowpackTotalDepth: row.snowpack_total_depth as number }),
    ...(row.snowpack_water_content !== null && { snowpackWaterContent: row.snowpack_water_content as number }),
    ...(row.snowpack_density !== null && { snowpackDensity: row.snowpack_density as number }),
    ...(row.obs_time !== null && { obsTime: row.obs_time as string }),
    ...(row.station_number !== null && { stationNumber: row.station_number as string }),
    ...(row.station_name !== null && { stationName: row.station_name as string }),
    ...(row.state !== null && { state: row.state as string }),
    ...(row.county !== null && { county: row.county as string }),
    ...(row.notes !== null && { notes: row.notes as string }),
    source: row.source as 'manual' | 'import',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export async function getAllObservations(options?: {
  startDate?: string
  endDate?: string
}): Promise<CoCoRaHSObservation[]> {
  let query = 'SELECT * FROM cocorahs_observations'
  const params: string[] = []
  const conditions: string[] = []

  if (options?.startDate) {
    conditions.push('date >= ?')
    params.push(options.startDate)
  }
  if (options?.endDate) {
    conditions.push('date <= ?')
    params.push(options.endDate)
  }

  if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`
  query += ' ORDER BY date DESC'

  const rows = db.prepare(query).all(...params) as RawRow[]
  return rows.map(rowToObservation)
}

export async function getObservationById(id: string): Promise<CoCoRaHSObservation | null> {
  const row = db
    .prepare('SELECT * FROM cocorahs_observations WHERE id = ?')
    .get(id) as RawRow | undefined
  return row ? rowToObservation(row) : null
}

export async function getObservationByDate(date: string): Promise<CoCoRaHSObservation | null> {
  const row = db
    .prepare('SELECT * FROM cocorahs_observations WHERE date = ?')
    .get(date) as RawRow | undefined
  return row ? rowToObservation(row) : null
}

export async function createObservation(
  data: CreateObservationRequest,
  source: 'manual' | 'import' = 'manual'
): Promise<CoCoRaHSObservation> {
  const existing = db
    .prepare('SELECT id FROM cocorahs_observations WHERE date = ?')
    .get(data.date)
  if (existing) throw new Error(`Observation already exists for date ${data.date}`)

  const id = generateId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO cocorahs_observations (
      id, date, rainfall, is_trace, snowfall, snowfall_new_depth, snowfall_water_content,
      snowfall_slr, snowpack_total_depth, snowpack_water_content, snowpack_density,
      obs_time, station_number, station_name, state, county, notes, source,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id, data.date, data.rainfall, data.isTrace ? 1 : 0,
    data.snowfall ?? null,
    data.snowfallNewDepth ?? null,
    data.snowfallWaterContent ?? null,
    data.snowfallSLR ?? null,
    data.snowpackTotalDepth ?? null,
    data.snowpackWaterContent ?? null,
    data.snowpackDensity ?? null,
    data.obsTime ?? null,
    data.stationNumber ?? null,
    data.stationName ?? null,
    data.state ?? null,
    data.county ?? null,
    data.notes ?? null,
    source, now, now
  )

  return (await getObservationById(id))!
}

export async function updateObservation(
  id: string,
  updates: UpdateObservationRequest
): Promise<CoCoRaHSObservation> {
  const existing = await getObservationById(id)
  if (!existing) throw new Error(`Observation not found: ${id}`)

  const now = new Date().toISOString()
  // Only rainfall, snowfall, and notes are updatable — this mirrors the
  // scope of UpdateObservationRequest. Extend both if more fields are needed.
  db.prepare(`
    UPDATE cocorahs_observations
    SET rainfall = ?, snowfall = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updates.rainfall ?? existing.rainfall,
    updates.snowfall !== undefined ? updates.snowfall : (existing.snowfall ?? null),
    updates.notes !== undefined ? updates.notes : (existing.notes ?? null),
    now, id
  )

  return (await getObservationById(id))!
}

export async function deleteObservation(id: string): Promise<void> {
  const result = db
    .prepare('DELETE FROM cocorahs_observations WHERE id = ?')
    .run(id)
  if (result.changes === 0) throw new Error(`Observation not found: ${id}`)
}

export async function bulkImportObservations(
  observations: CreateObservationRequest[]
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO cocorahs_observations (
      id, date, rainfall, is_trace, snowfall, snowfall_new_depth, snowfall_water_content,
      snowfall_slr, snowpack_total_depth, snowpack_water_content, snowpack_density,
      obs_time, station_number, station_name, state, county, notes, source,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  for (const obs of observations) {
    try {
      const now = new Date().toISOString()
      const result = insertStmt.run(
        generateId(), obs.date, obs.rainfall, obs.isTrace ? 1 : 0,
        obs.snowfall ?? null,
        obs.snowfallNewDepth ?? null,
        obs.snowfallWaterContent ?? null,
        obs.snowfallSLR ?? null,
        obs.snowpackTotalDepth ?? null,
        obs.snowpackWaterContent ?? null,
        obs.snowpackDensity ?? null,
        obs.obsTime ?? null,
        obs.stationNumber ?? null,
        obs.stationName ?? null,
        obs.state ?? null,
        obs.county ?? null,
        obs.notes ?? null,
        'import', now, now
      )
      if (result.changes > 0) imported++
      else skipped++
    } catch (error) {
      errors.push(`Date ${obs.date}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { imported, skipped, errors }
}

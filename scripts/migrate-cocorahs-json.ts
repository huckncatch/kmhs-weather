/**
 * One-time migration: cocorahs.json → SQLite
 *
 * Run: npx tsx scripts/migrate-cocorahs-json.ts
 *
 * Safe to re-run — duplicates are silently skipped.
 * data/cocorahs.json is left intact until you manually delete it.
 */

import path from 'path'
import { promises as fs } from 'fs'

// Import db first to ensure tables are created before any inserts
import db from '../src/lib/data/db'
import type { CoCoRaHSStorage } from '../src/types/cocorahs'

async function migrate() {
  const jsonPath = path.join(process.cwd(), 'data', 'cocorahs.json')

  let raw: string
  try {
    raw = await fs.readFile(jsonPath, 'utf-8')
  } catch {
    console.error(`Could not read ${jsonPath} — does it exist?`)
    process.exit(1)
  }

  const storage: CoCoRaHSStorage = JSON.parse(raw)
  const observations = storage.observations

  console.log(`Found ${observations.length} observations in cocorahs.json`)

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cocorahs_observations (
      id, date, rainfall, snowfall, snowfall_new_depth, snowfall_water_content,
      snowfall_slr, snowpack_total_depth, snowpack_water_content, snowpack_density,
      obs_time, station_number, station_name, state, county, notes, source,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  let migrated = 0
  let skipped = 0
  const errors: string[] = []

  for (const obs of observations) {
    try {
      const result = stmt.run(
        obs.id,
        obs.date,
        obs.rainfall,
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
        obs.source,
        obs.createdAt,
        obs.updatedAt
      )
      if (result.changes > 0) migrated++
      else skipped++
    } catch (err) {
      errors.push(`${obs.id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  console.log(`\nMigration complete:`)
  console.log(`  ✓ ${migrated} migrated`)
  console.log(`  - ${skipped} skipped (duplicates)`)
  if (errors.length > 0) {
    console.error(`  ✗ ${errors.length} errors:`)
    errors.forEach((e) => console.error(`    ${e}`))
  }

  db.close()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

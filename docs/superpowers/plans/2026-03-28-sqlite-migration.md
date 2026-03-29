# SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate CoCoRaHS JSON file storage and Ambient Weather API data to a local SQLite database, preserving all existing observations and accumulating full-resolution station readings going forward.

**Architecture:** Single `data/weather.db` SQLite file with two tables (`cocorahs_observations`, `ambient_readings`). A shared db singleton (`db.ts`) opens the file once and initializes the schema. `cocorahs-storage.ts` internals are replaced with SQLite queries while keeping the same async interface. A shared history fetcher handles both the one-time backfill script and the automatic gap-fill on cold start.

**Tech Stack:** `better-sqlite3` (synchronous SQLite driver, no ORM), Vitest (test runner), `tsx` (runs TypeScript scripts directly)

**Spec:** `docs/superpowers/specs/2026-03-28-sqlite-migration-design.md`

---

## Chunk 1: Foundation

Sets up dependencies, test runner, the database singleton, and `.gitignore`. Everything else depends on this.

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and dev dependencies**

```bash
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3 vitest
```

`better-sqlite3` compiles a native C++ addon on install — this is expected and handled automatically.

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Verify install succeeded**

```bash
pnpm test || true
```

Expected: something like `No test files found` — that's fine, no tests exist yet. (Vitest exits non-zero when no test files are found, so `|| true` prevents the shell from treating it as a failure.)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add better-sqlite3 and vitest"
```

---

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create smoke test to verify Vitest works**

Create `src/lib/data/__tests__/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('db', () => {
  it('placeholder — remove after db.ts exists', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      DB_PATH: ':memory:',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

The `DB_PATH: ':memory:'` env var tells `db.ts` to use an in-memory SQLite database during tests instead of creating a real file.

Vitest applies `test.env` values to `process.env` before importing test files, so `db.ts` — which reads `process.env.DB_PATH` at module load time — will see `:memory:` before `new Database(...)` is called. Each SQLite `new Database(':memory:')` call creates an independent, isolated in-memory database, so there is no cross-file contamination.

- [ ] **Step 3: Run the smoke test**

```bash
pnpm test
```

Expected: `✓ src/lib/data/__tests__/db.test.ts > db > placeholder`

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts src/lib/data/__tests__/db.test.ts
git commit -m "chore: configure vitest with in-memory SQLite test env"
```

---

### Task 3: Create `db.ts`

**Files:**
- Create: `src/lib/data/db.ts`
- Modify: `src/lib/data/__tests__/db.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the placeholder in `src/lib/data/__tests__/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import db from '../db'

describe('db', () => {
  it('creates cocorahs_observations table', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cocorahs_observations'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('cocorahs_observations')
  })

  it('creates ambient_readings table', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ambient_readings'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('ambient_readings')
  })

  it('creates date index on ambient_readings', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_ambient_readings_date'")
      .get() as { name: string } | undefined
    expect(row?.name).toBe('idx_ambient_readings_date')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test src/lib/data/__tests__/db.test.ts
```

Expected: FAIL — `Cannot find module '../db'`

- [ ] **Step 3: Create `src/lib/data/db.ts`**

```typescript
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'weather.db')

const db = new Database(DB_PATH)

// WAL mode: better read concurrency, faster writes
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS cocorahs_observations (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    rainfall REAL NOT NULL,
    snowfall REAL,
    snowfall_new_depth REAL,
    snowfall_water_content REAL,
    snowfall_slr REAL,
    snowpack_total_depth REAL,
    snowpack_water_content REAL,
    snowpack_density REAL,
    obs_time TEXT,
    station_number TEXT,
    station_name TEXT,
    state TEXT,
    county TEXT,
    notes TEXT,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ambient_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    temp_f REAL,
    feels_like REAL,
    temp_indoor_f REAL,
    humidity REAL,
    humidity_indoor REAL,
    wind_speed_mph REAL,
    wind_dir INTEGER,
    wind_gust_mph REAL,
    pressure_relative REAL,
    pressure_absolute REAL,
    daily_rain_in REAL,
    uv REAL,
    solar_radiation REAL,
    battery_ok INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ambient_readings_date ON ambient_readings(date);
`)

export default db
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/lib/data/__tests__/db.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/db.ts src/lib/data/__tests__/db.test.ts
git commit -m "feat: add SQLite database singleton with schema init"
```

---

### Task 4: Update `.gitignore`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `data/*.db` to `.gitignore`**

In `.gitignore`, find the `# Data Storage` section and add `data/*.db`:

```
# Data Storage
data/*.json
data/*.db
!data/.gitkeepCoCoRaHS
```

- [ ] **Step 2: Verify `data/weather.db` would be ignored**

```bash
echo "data/weather.db" | git check-ignore --stdin
```

Expected: `data/weather.db`

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore SQLite database files"
```

---

## Chunk 2: CoCoRaHS Storage Rewrite

Replaces the JSON file internals of `cocorahs-storage.ts` with SQLite. The exported function signatures and `async` wrappers are unchanged — all callers work without modification.

### Task 5: Fix `CreateObservationRequest` type

**Files:**
- Modify: `src/types/cocorahs.ts`

`snowfallNewDepth` exists on `CoCoRaHSObservation` but was never added to `CreateObservationRequest`. The storage rewrite needs to accept it — fixing the type now prevents a cast workaround in the implementation.

- [ ] **Step 1: Add `snowfallNewDepth` to `CreateObservationRequest`**

In `src/types/cocorahs.ts`, in the `CreateObservationRequest` interface, add after `snowfall?`:

```typescript
/** 24-hour new snow depth in inches */
snowfallNewDepth?: number;
```

- [ ] **Step 2: Type-check to confirm no regressions**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/cocorahs.ts
git commit -m "fix: add snowfallNewDepth to CreateObservationRequest type"
```

---

### Task 6: Rewrite `cocorahs-storage.ts`

**Files:**
- Modify: `src/lib/data/cocorahs-storage.ts`
- Create: `src/lib/data/__tests__/cocorahs-storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/data/__tests__/cocorahs-storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import db from '../db'
import {
  getAllObservations,
  getObservationById,
  getObservationByDate,
  createObservation,
  updateObservation,
  deleteObservation,
  bulkImportObservations,
} from '../cocorahs-storage'

// Clear the in-memory DB between each test
beforeEach(() => {
  db.exec('DELETE FROM cocorahs_observations')
})

describe('createObservation', () => {
  it('inserts a new observation and returns it', async () => {
    const obs = await createObservation({ date: '2026-03-01', rainfall: 0.42 })
    expect(obs.id).toMatch(/^obs-/)
    expect(obs.date).toBe('2026-03-01')
    expect(obs.rainfall).toBe(0.42)
    expect(obs.source).toBe('manual')
    expect(obs.createdAt).toBeTruthy()
  })

  it('throws if observation already exists for that date', async () => {
    await createObservation({ date: '2026-03-01', rainfall: 0.1 })
    await expect(createObservation({ date: '2026-03-01', rainfall: 0.2 })).rejects.toThrow(
      'already exists'
    )
  })

  it('accepts import source', async () => {
    const obs = await createObservation({ date: '2026-03-02', rainfall: 0 }, 'import')
    expect(obs.source).toBe('import')
  })

  it('stores optional snowfall fields', async () => {
    const obs = await createObservation({
      date: '2026-03-03',
      rainfall: 0,
      snowfall: 2.5,
      snowfallWaterContent: 0.25,
    })
    expect(obs.snowfall).toBe(2.5)
    expect(obs.snowfallWaterContent).toBe(0.25)
  })
})

describe('getAllObservations', () => {
  it('returns observations sorted newest first', async () => {
    await createObservation({ date: '2026-03-01', rainfall: 0.1 })
    await createObservation({ date: '2026-03-05', rainfall: 0.5 })
    const obs = await getAllObservations()
    expect(obs[0].date).toBe('2026-03-05')
    expect(obs[1].date).toBe('2026-03-01')
  })

  it('filters by date range', async () => {
    await createObservation({ date: '2026-02-01', rainfall: 0.1 })
    await createObservation({ date: '2026-03-01', rainfall: 0.2 })
    await createObservation({ date: '2026-04-01', rainfall: 0.3 })
    const obs = await getAllObservations({ startDate: '2026-03-01', endDate: '2026-03-31' })
    expect(obs).toHaveLength(1)
    expect(obs[0].date).toBe('2026-03-01')
  })
})

describe('getObservationById', () => {
  it('returns observation by id', async () => {
    const created = await createObservation({ date: '2026-03-01', rainfall: 0.1 })
    const found = await getObservationById(created.id)
    expect(found?.id).toBe(created.id)
  })

  it('returns null for unknown id', async () => {
    const found = await getObservationById('obs-unknown')
    expect(found).toBeNull()
  })
})

describe('getObservationByDate', () => {
  it('returns observation for date', async () => {
    await createObservation({ date: '2026-03-01', rainfall: 0.42 })
    const found = await getObservationByDate('2026-03-01')
    expect(found?.rainfall).toBe(0.42)
  })

  it('returns null for date with no observation', async () => {
    const found = await getObservationByDate('2026-01-01')
    expect(found).toBeNull()
  })
})

describe('updateObservation', () => {
  it('updates rainfall and notes', async () => {
    const obs = await createObservation({ date: '2026-03-01', rainfall: 0.1 })
    const updated = await updateObservation(obs.id, { rainfall: 0.99, notes: 'corrected' })
    expect(updated.rainfall).toBe(0.99)
    expect(updated.notes).toBe('corrected')
  })

  it('throws for unknown id', async () => {
    await expect(updateObservation('obs-nope', { rainfall: 1 })).rejects.toThrow('not found')
  })
})

describe('deleteObservation', () => {
  it('removes the observation', async () => {
    const obs = await createObservation({ date: '2026-03-01', rainfall: 0.1 })
    await deleteObservation(obs.id)
    const found = await getObservationById(obs.id)
    expect(found).toBeNull()
  })

  it('throws for unknown id', async () => {
    await expect(deleteObservation('obs-nope')).rejects.toThrow('not found')
  })
})

describe('bulkImportObservations', () => {
  it('imports multiple observations', async () => {
    const result = await bulkImportObservations([
      { date: '2026-01-01', rainfall: 0.1 },
      { date: '2026-01-02', rainfall: 0.2 },
    ])
    expect(result.imported).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('skips duplicate dates', async () => {
    await createObservation({ date: '2026-01-01', rainfall: 0.1 })
    const result = await bulkImportObservations([
      { date: '2026-01-01', rainfall: 0.9 }, // duplicate
      { date: '2026-01-02', rainfall: 0.2 },
    ])
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test src/lib/data/__tests__/cocorahs-storage.test.ts
```

Expected: FAIL — tests call the existing JSON-based implementation.

- [ ] **Step 3: Rewrite `src/lib/data/cocorahs-storage.ts`**

```typescript
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
      id, date, rainfall, snowfall, snowfall_new_depth, snowfall_water_content,
      snowfall_slr, snowpack_total_depth, snowpack_water_content, snowpack_density,
      obs_time, station_number, station_name, state, county, notes, source,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id, data.date, data.rainfall,
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
      id, date, rainfall, snowfall, snowfall_new_depth, snowfall_water_content,
      snowfall_slr, snowpack_total_depth, snowpack_water_content, snowpack_density,
      obs_time, station_number, station_name, state, county, notes, source,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  for (const obs of observations) {
    try {
      const now = new Date().toISOString()
      const result = insertStmt.run(
        generateId(), obs.date, obs.rainfall,
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/lib/data/__tests__/cocorahs-storage.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite to confirm nothing regressed**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/cocorahs-storage.ts src/lib/data/__tests__/cocorahs-storage.test.ts
git commit -m "feat: rewrite cocorahs-storage internals to use SQLite"
```

---

## Chunk 3: Ambient Storage

### Task 7: Create `ambient-storage.ts`

**Files:**
- Create: `src/lib/data/ambient-storage.ts`
- Create: `src/lib/data/__tests__/ambient-storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/data/__tests__/ambient-storage.test.ts`:

```typescript
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
```

Note: `getReadings` returns a simplified row shape (not full `AmbientWeatherData`). The `date` field in the result is `YYYY-MM-DD` from the stored `date` column, not the original API string. Adjust the type as needed.

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test src/lib/data/__tests__/ambient-storage.test.ts
```

Expected: FAIL — `Cannot find module '../ambient-storage'`

- [ ] **Step 3: Create `src/lib/data/ambient-storage.ts`**

```typescript
import db from './db'
import type { AmbientWeatherData } from '@/types/ambient-weather'

interface AmbientReadingRow {
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/lib/data/__tests__/ambient-storage.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/ambient-storage.ts src/lib/data/__tests__/ambient-storage.test.ts
git commit -m "feat: add ambient-storage module (saveReading, getReadings, getLatestTimestamp)"
```

---

## Chunk 4: History Fetcher

Shared utility called by both the backfill script and the gap-fill in the API route.

### Task 8: Create `ambient-history-fetcher.ts`

**Files:**
- Create: `src/lib/data/ambient-history-fetcher.ts`
- Create: `src/lib/data/__tests__/ambient-history-fetcher.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/data/__tests__/ambient-history-fetcher.test.ts`:

```typescript
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

    // Batch contains one reading in range, one too old
    mockGetDeviceData.mockResolvedValueOnce([
      makeApiReading(to),
      makeApiReading(old), // should stop here
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
    mockGetDeviceData.mockResolvedValueOnce([]) // empty — stop immediately

    const result = await fetchAndSaveAmbientHistory(
      Date.now() - 86400000,
      Date.now(),
      CREDENTIALS
    )

    expect(result.saved).toBe(0)
    expect(mockGetDeviceData).toHaveBeenCalledTimes(1)
  })

  it('calls onProgress callback every 500 readings', async () => {
    // Generate 501 readings
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test src/lib/data/__tests__/ambient-history-fetcher.test.ts
```

Expected: FAIL — `Cannot find module '../ambient-history-fetcher'`

- [ ] **Step 3: Create `src/lib/data/ambient-history-fetcher.ts`**

```typescript
import { getDeviceData } from '@/lib/api/ambient'
import { saveReading } from './ambient-storage'

const BATCH_SIZE = 288
const RATE_LIMIT_DELAY_MS = 1100 // 1 request/second per API key

/**
 * Fetch Ambient Weather history between two epoch-ms timestamps and save to DB.
 * Paginates backwards through time using the API's endDate parameter.
 * Safe to call multiple times — duplicates are silently skipped.
 *
 * @param fromMs   Start of range (epoch ms, inclusive)
 * @param toMs     End of range (epoch ms, inclusive)
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

  while (true) {
    const batch = await getDeviceData({
      apiKey: credentials.apiKey,
      applicationKey: credentials.applicationKey,
      macAddress: credentials.macAddress,
      endDate,
      limit: BATCH_SIZE,
    })

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

    // Respect API rate limit: 1 request/second per apiKey
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS))
  }

  return { saved, skipped }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test src/lib/data/__tests__/ambient-history-fetcher.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/ambient-history-fetcher.ts src/lib/data/__tests__/ambient-history-fetcher.test.ts
git commit -m "feat: add ambient-history-fetcher shared utility"
```

---

## Chunk 5: Route Update and Scripts

### Task 9: Update `ambient/route.ts` for auto-save and gap-fill

**Files:**
- Modify: `src/app/api/weather/ambient/route.ts`

No new tests needed — the route logic is thin glue code that calls already-tested modules. Manual verification is the appropriate check here.

- [ ] **Step 1: Add auto-save and gap-fill to `src/app/api/weather/ambient/route.ts`**

Add these imports at the top of the file:

```typescript
import { saveReading, getLatestTimestamp } from '@/lib/data/ambient-storage'
import { fetchAndSaveAmbientHistory } from '@/lib/data/ambient-history-fetcher'
```

Add this module-level variable just before the `GET` function:

```typescript
let gapFillAttempted = false
```

In the `case 'latest':` block, after the `if (!latestData)` check and before the final `return NextResponse.json(...)`, add:

```typescript
// Auto-save this reading to the database
try {
  saveReading(latestData)
} catch (err) {
  console.error('[ambient-storage] saveReading failed:', err)
}

// On first request after cold start, fill any gap since last saved reading
if (!gapFillAttempted) {
  gapFillAttempted = true
  const latestSaved = getLatestTimestamp()
  if (latestSaved) {
    const latestSavedMs = new Date(latestSaved).getTime()
    const gapMinutes = (Date.now() - latestSavedMs) / 60000
    if (gapMinutes > 5) {
      // Fire-and-forget: don't await, don't block the response
      fetchAndSaveAmbientHistory(latestSavedMs, Date.now(), {
        ...credentials,
        macAddress,
      }).catch((err) => console.error('[gap-fill] failed:', err))
    }
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Start the dev server and load the dashboard**

```bash
pnpm dev
```

Open the dashboard in a browser. Check the terminal for any errors. You should see no errors and the weather data should load normally.

- [ ] **Step 4: Confirm a reading was saved**

In a separate terminal while the dev server is running:

```bash
npx tsx -e "
import db from './src/lib/data/db.ts'
const count = db.prepare('SELECT COUNT(*) as n FROM ambient_readings').get()
console.log(count)
"
```

Expected: `{ n: 1 }` (or more if you refreshed multiple times).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/weather/ambient/route.ts
git commit -m "feat: auto-save ambient readings and gap-fill on cold start"
```

---

### Task 10: Create CoCoRaHS migration script

**Files:**
- Create: `scripts/migrate-cocorahs-json.ts`

- [ ] **Step 1: Create `scripts/migrate-cocorahs-json.ts`**

```typescript
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
```

- [ ] **Step 2: Run the migration script**

```bash
npx tsx scripts/migrate-cocorahs-json.ts
```

Expected output (example):

```
Found 47 observations in cocorahs.json

Migration complete:
  ✓ 47 migrated
  - 0 skipped (duplicates)
```

- [ ] **Step 3: Verify the data landed in SQLite**

```bash
npx tsx -e "
import db from './src/lib/data/db.ts'
const count = db.prepare('SELECT COUNT(*) as n FROM cocorahs_observations').get()
console.log('CoCoRaHS rows:', count)
const latest = db.prepare('SELECT date, rainfall FROM cocorahs_observations ORDER BY date DESC LIMIT 3').all()
console.log('Most recent:', latest)
"
```

Expected: row count matches what was in the JSON, most recent dates look correct.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-cocorahs-json.ts
git commit -m "feat: add CoCoRaHS JSON-to-SQLite migration script"
```

---

### Task 11: Create Ambient Weather backfill script

**Files:**
- Create: `scripts/backfill-ambient.ts`

- [ ] **Step 1: Create `scripts/backfill-ambient.ts`**

```typescript
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
```

- [ ] **Step 2: Dry-run check — verify credentials and device detection**

```bash
npx tsx -e "
import { validateApiCredentials, getDevices } from './src/lib/api/ambient.ts'
const creds = validateApiCredentials()
const devices = await getDevices(creds)
console.log('Device found:', devices[0]?.info.name, devices[0]?.macAddress)
"
```

Expected: your station name and MAC address. If this fails, check `.env.local`.

- [ ] **Step 3: Run the backfill (this will take ~6-10 minutes)**

```bash
npx tsx scripts/backfill-ambient.ts
```

Expected (example):
```
Device: KMHS Weather (AA:BB:CC:DD:EE:FF)
Fetching history from 2025-03-28 to 2026-03-28...
(This takes ~6-10 minutes due to API rate limiting — 1 request/sec)

  Progress: 500 readings saved...
  Progress: 1000 readings saved...
  ...

Backfill complete:
  ✓ 104832 readings saved
  - 3 skipped (already in database)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-ambient.ts
git commit -m "feat: add Ambient Weather historical backfill script"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: no errors (fix any that appear before committing).

- [ ] **Step 4: Verify SQLite data integrity**

```bash
npx tsx -e "
import db from './src/lib/data/db.ts'
const cocorahs = db.prepare('SELECT COUNT(*) as n FROM cocorahs_observations').get()
const ambient = db.prepare('SELECT COUNT(*) as n FROM ambient_readings').get()
const latest = db.prepare('SELECT timestamp FROM ambient_readings ORDER BY timestamp DESC LIMIT 1').get()
console.log('CoCoRaHS observations:', cocorahs)
console.log('Ambient readings:', ambient)
console.log('Latest reading:', latest)
"
```

- [ ] **Step 5: Update spec status to Approved**

In `docs/superpowers/specs/2026-03-28-sqlite-migration-design.md`, change `Status: Draft` to `Status: Approved`.

```bash
git add docs/superpowers/specs/2026-03-28-sqlite-migration-design.md
git commit -m "docs: mark SQLite migration spec as approved"
```

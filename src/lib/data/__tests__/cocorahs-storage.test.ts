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

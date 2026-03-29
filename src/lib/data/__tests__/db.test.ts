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

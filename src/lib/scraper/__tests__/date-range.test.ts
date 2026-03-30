import { describe, it, expect } from 'vitest'
import { resolveDateRange } from '../date-range'

describe('resolveDateRange', () => {
  const TODAY = '2026-03-29'

  it('all mode returns 2000-01-01 to today', () => {
    const { startDate, endDate } = resolveDateRange({ mode: 'all' }, TODAY)
    expect(startDate).toBe('2000-01-01')
    expect(endDate).toBe(TODAY)
  })

  it('recent mode with days=30 returns today-30 to today', () => {
    const { startDate, endDate } = resolveDateRange({ mode: 'recent', days: 30 }, TODAY)
    expect(startDate).toBe('2026-02-27')
    expect(endDate).toBe(TODAY)
  })

  it('recent mode defaults to 30 days', () => {
    const { startDate, endDate } = resolveDateRange({ mode: 'recent' }, TODAY)
    expect(startDate).toBe('2026-02-27')
    expect(endDate).toBe(TODAY)
  })

  it('range mode returns provided dates unchanged', () => {
    const { startDate, endDate } = resolveDateRange({
      mode: 'range',
      startDate: '2026-01-01',
      endDate: '2026-03-01',
    }, TODAY)
    expect(startDate).toBe('2026-01-01')
    expect(endDate).toBe('2026-03-01')
  })

  it('missing mode with existing observations uses earliest DB date to today', () => {
    const { startDate, endDate } = resolveDateRange(
      { mode: 'missing' },
      TODAY,
      '2025-06-01'
    )
    expect(startDate).toBe('2025-06-01')
    expect(endDate).toBe(TODAY)
  })

  it('missing mode with empty DB falls back to all mode', () => {
    const { startDate, endDate } = resolveDateRange(
      { mode: 'missing' },
      TODAY,
      null
    )
    expect(startDate).toBe('2000-01-01')
    expect(endDate).toBe(TODAY)
  })

  it('throws if range mode is missing startDate', () => {
    expect(() => resolveDateRange({ mode: 'range', endDate: '2026-03-01' }, TODAY))
      .toThrow('startDate and endDate required')
  })

  it('throws if range mode is missing endDate', () => {
    expect(() => resolveDateRange({ mode: 'range', startDate: '2026-01-01' }, TODAY))
      .toThrow('startDate and endDate required')
  })
})

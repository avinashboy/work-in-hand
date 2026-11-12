import { describe, expect, it } from 'vitest'
import {
  NO_HISTORY_FILTER,
  archiveQuerySchema,
  isHistoryFiltered,
  resolveHistoryBounds,
  type HistoryFilter,
} from './history-filter'

const NOW = Date.UTC(2026, 10, 10, 15, 30) // 10 Nov 2026, 15:30 UTC
const DAY = 24 * 60 * 60 * 1000

function filter(overrides: Partial<HistoryFilter>): HistoryFilter {
  return { ...NO_HISTORY_FILTER, ...overrides }
}

describe('resolveHistoryBounds', () => {
  it('uses the chosen start and end for a year or month', () => {
    expect(resolveHistoryBounds(filter({ range: 'period', from: 100, to: 200 }), NOW)).toEqual({
      after: 100,
      before: 200,
    })
  })

  it('has no bounds for any time', () => {
    expect(resolveHistoryBounds(NO_HISTORY_FILTER, NOW)).toEqual({ after: null, before: null })
  })

  it('counts days back from now', () => {
    expect(resolveHistoryBounds(filter({ range: '7d' }), NOW)).toEqual({ after: NOW - 7 * DAY, before: null })
    expect(resolveHistoryBounds(filter({ range: '30d' }), NOW)).toEqual({ after: NOW - 30 * DAY, before: null })
  })

  it('counts calendar months back from now', () => {
    expect(resolveHistoryBounds(filter({ range: '3m' }), NOW).after).toBe(Date.UTC(2026, 7, 10, 15, 30))
    expect(resolveHistoryBounds(filter({ range: '6m' }), NOW).after).toBe(Date.UTC(2026, 4, 10, 15, 30))
    expect(resolveHistoryBounds(filter({ range: '12m' }), NOW).after).toBe(Date.UTC(2025, 10, 10, 15, 30))
  })

  it('stops at the last day of a shorter month instead of spilling over', () => {
    const endOfMay = Date.UTC(2026, 4, 31, 12)

    expect(resolveHistoryBounds(filter({ range: '3m' }), endOfMay).after).toBe(Date.UTC(2026, 1, 28, 12))
  })

  it('uses the custom start and end as given', () => {
    const from = Date.UTC(2026, 0, 1, 9)
    const to = Date.UTC(2026, 2, 31, 18)

    expect(resolveHistoryBounds(filter({ range: 'custom', from, to }), NOW)).toEqual({ after: from, before: to })
  })

  it('allows a custom range with only a start or only an end', () => {
    const from = Date.UTC(2026, 0, 1)

    expect(resolveHistoryBounds(filter({ range: 'custom', from }), NOW)).toEqual({ after: from, before: null })
    expect(resolveHistoryBounds(filter({ range: 'custom', to: from }), NOW)).toEqual({ after: null, before: from })
  })

  it('swaps a custom range entered back to front', () => {
    const early = Date.UTC(2026, 0, 1)
    const late = Date.UTC(2026, 5, 1)

    expect(resolveHistoryBounds(filter({ range: 'custom', from: late, to: early }), NOW)).toEqual({
      after: early,
      before: late,
    })
  })

  it('ignores custom dates when a preset is chosen', () => {
    const bounds = resolveHistoryBounds(filter({ range: '7d', from: 1, to: 2 }), NOW)

    expect(bounds).toEqual({ after: NOW - 7 * DAY, before: null })
  })
})

describe('isHistoryFiltered', () => {
  it('is false with no words and any time', () => {
    expect(isHistoryFiltered(NO_HISTORY_FILTER)).toBe(false)
    expect(isHistoryFiltered(filter({ search: '   ' }))).toBe(false)
  })

  it('is true with words or a date range', () => {
    expect(isHistoryFiltered(filter({ search: 'invoice' }))).toBe(true)
    expect(isHistoryFiltered(filter({ range: '3m' }))).toBe(true)
  })
})

describe('archiveQuerySchema', () => {
  it('takes 20, 30, 40 or 50 cards a page, and nothing else', () => {
    for (const pageSize of [20, 30, 40, 50]) {
      expect(archiveQuerySchema.safeParse({ page: 1, pageSize, filter: NO_HISTORY_FILTER }).success).toBe(true)
    }
    for (const pageSize of [0, 25, 1000]) {
      expect(archiveQuerySchema.safeParse({ page: 1, pageSize, filter: NO_HISTORY_FILTER }).success).toBe(false)
    }
  })

  it('trims the words', () => {
    const parsed = archiveQuerySchema.parse({ page: 1, pageSize: 20, filter: filter({ search: '  invoice  ' }) })

    expect(parsed.filter.search).toBe('invoice')
  })

  it('refuses over-long words, unknown ranges and bad dates', () => {
    expect(archiveQuerySchema.safeParse({ page: 1, pageSize: 20, filter: filter({ search: 'x'.repeat(101) }) }).success).toBe(false)
    expect(archiveQuerySchema.safeParse({ page: 1, pageSize: 20, filter: { ...NO_HISTORY_FILTER, range: '2y' } }).success).toBe(false)
    expect(archiveQuerySchema.safeParse({ page: 1, pageSize: 20, filter: filter({ range: 'custom', from: -5 }) }).success).toBe(false)
    expect(archiveQuerySchema.safeParse({ page: 1, pageSize: 20, filter: filter({ range: 'custom', to: 1.5 }) }).success).toBe(false)
  })
})

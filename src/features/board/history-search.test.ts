import { describe, expect, it } from 'vitest'
import {
  filterFromSearch,
  fromLocalInputValue,
  historySearchSchema,
  pageSizeFromSearch,
  searchFromFilter,
  toLocalInputValue,
} from './history-search'
import { NO_HISTORY_FILTER } from './history-filter'

describe('date-time box values', () => {
  it('round-trips a time through the box, to the minute', () => {
    const time = new Date(2026, 4, 17, 9, 45).getTime() // 17 May 2026, 09:45 local

    expect(toLocalInputValue(time)).toBe('2026-05-17T09:45')
    expect(fromLocalInputValue('2026-05-17T09:45')).toBe(time)
  })

  it('reads an empty or broken box as no time', () => {
    expect(fromLocalInputValue('')).toBeNull()
    expect(fromLocalInputValue('not a date')).toBeNull()
  })
})

describe('History address', () => {
  it('reads a full filter from the address', () => {
    const search = historySearchSchema.parse({ q: 'invoice', range: 'custom', from: 100, to: 200, page: 2 })

    expect(filterFromSearch(search)).toEqual({ search: 'invoice', range: 'custom', from: 100, to: 200 })
  })

  it('keeps words that look like numbers as words', () => {
    expect(filterFromSearch(historySearchSchema.parse({ q: 2025 })).search).toBe('2025')
  })

  it('drops bad values instead of failing the page', () => {
    const search = historySearchSchema.parse({ q: 'x'.repeat(500), range: 'forever', from: -1, to: 'soon' })

    expect(filterFromSearch(search)).toEqual(NO_HISTORY_FILTER)
  })

  it('keeps custom dates only with a custom range', () => {
    expect(filterFromSearch(historySearchSchema.parse({ range: '3m', from: 100 }))).toEqual({
      ...NO_HISTORY_FILTER,
      range: '3m',
    })
  })

  it('reads the page size, falling back to 20 for anything not offered', () => {
    expect(pageSizeFromSearch(historySearchSchema.parse({ size: 40 }))).toBe(40)
    expect(pageSizeFromSearch(historySearchSchema.parse({ size: 25 }))).toBe(20)
    expect(pageSizeFromSearch(historySearchSchema.parse({}))).toBe(20)
  })

  it('writes a short address, leaving out defaults', () => {
    expect(searchFromFilter(NO_HISTORY_FILTER)).toEqual({})
    expect(searchFromFilter({ search: ' invoice ', range: '6m', from: null, to: null })).toEqual({
      q: 'invoice',
      range: '6m',
    })
    expect(searchFromFilter({ search: '', range: 'custom', from: 100, to: null })).toEqual({
      range: 'custom',
      from: 100,
    })
  })
})

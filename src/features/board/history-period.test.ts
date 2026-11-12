import { describe, expect, it } from 'vitest'
import { historyYears, periodBounds, periodFromBounds, yearsWithCards } from './history-period'

describe('periodBounds', () => {
  it('covers a whole month in the viewer’s time zone, both ends included', () => {
    expect(periodBounds({ year: 2024, month: 10 })).toEqual({
      from: new Date(2024, 10, 1).getTime(),
      to: new Date(2024, 11, 1).getTime() - 1,
    })
  })

  it('covers January to December for a whole year', () => {
    expect(periodBounds({ year: 2026, month: null })).toEqual({
      from: new Date(2026, 0, 1).getTime(),
      to: new Date(2027, 0, 1).getTime() - 1,
    })
  })

  it('rolls December over into the next year', () => {
    expect(periodBounds({ year: 2025, month: 11 }).to).toBe(new Date(2026, 0, 1).getTime() - 1)
  })
})

describe('periodFromBounds', () => {
  it('reads back a month', () => {
    const { from, to } = periodBounds({ year: 2026, month: 10 })

    expect(periodFromBounds(from, to)).toEqual({ year: 2026, month: 10 })
  })

  it('reads back a whole year', () => {
    const { from, to } = periodBounds({ year: 2024, month: null })

    expect(periodFromBounds(from, to)).toEqual({ year: 2024, month: null })
  })

  it('gives nothing when the start is missing', () => {
    expect(periodFromBounds(null, null)).toBeNull()
  })
})

describe('yearsWithCards', () => {
  const utcYear = (time: number) => new Date(time).getUTCFullYear()

  it('lists each year that has cards once, newest first', () => {
    const spans = [
      { first: Date.UTC(2026, 0, 5), last: Date.UTC(2026, 10, 1) },
      { first: Date.UTC(2024, 2, 1), last: Date.UTC(2024, 5, 1) },
    ]

    expect(yearsWithCards(spans, utcYear)).toEqual([2026, 2024])
  })

  it('moves a card from late on New Year’s Eve into the next year where it is already that year', () => {
    const lateInIndia = (time: number) => new Date(time + 5.5 * 60 * 60 * 1000).getUTCFullYear()
    const onlyNewYearsEve = [{ first: Date.UTC(2025, 11, 31, 22), last: Date.UTC(2025, 11, 31, 22) }]
    const alsoEarlier = [{ first: Date.UTC(2025, 5, 1), last: Date.UTC(2025, 11, 31, 22) }]

    expect(yearsWithCards(onlyNewYearsEve, lateInIndia)).toEqual([2026])
    expect(yearsWithCards(alsoEarlier, lateInIndia)).toEqual([2026, 2025])
  })

  it('has no years when History is empty', () => {
    expect(yearsWithCards([], utcYear)).toEqual([])
  })
})

describe('historyYears', () => {
  it('offers only the years that have cards', () => {
    expect(historyYears([2026, 2024], 2026)).toEqual([2026, 2024])
  })

  it('offers this year when History is empty', () => {
    expect(historyYears([], 2026)).toEqual([2026])
  })

  it('keeps a chosen year in the list, in order, even with no cards', () => {
    expect(historyYears([2026, 2022], 2026, 2024)).toEqual([2026, 2024, 2022])
    expect(historyYears([2026], 2026, 2026)).toEqual([2026])
  })
})

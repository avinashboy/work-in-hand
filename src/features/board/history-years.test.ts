import { describe, expect, it } from 'vitest'
import { groupByYear, localYear, utcYear } from './history-years'

const at = (iso: string) => ({ id: iso, archivedAt: Date.parse(iso) })

describe('groupByYear', () => {
  it('splits newest-first cards into one group per year, in order', () => {
    const tasks = [
      at('2026-11-02T10:00:00Z'),
      at('2026-01-15T10:00:00Z'),
      at('2025-12-31T10:00:00Z'),
      at('2023-06-01T10:00:00Z'),
      at('2023-02-01T10:00:00Z'),
    ]

    const groups = groupByYear(tasks, utcYear)

    expect(groups.map(({ year, tasks: inYear }) => [year, inYear.length])).toEqual([
      [2026, 2],
      [2025, 1],
      [2023, 2],
    ])
    expect(groups[0].tasks[0]).toBe(tasks[0])
  })

  it('gives no groups for no cards', () => {
    expect(groupByYear([], utcYear)).toEqual([])
  })

  it('uses whichever year reading it is given', () => {
    const newYearsEve = at('2025-12-31T23:30:00Z')

    expect(groupByYear([newYearsEve], utcYear)[0].year).toBe(2025)
    expect(groupByYear([newYearsEve], () => 2026)[0].year).toBe(2026)
  })

  it('reads the local year in the viewer’s own time zone', () => {
    const time = new Date(2024, 0, 1, 0, 30).getTime() // 00:30 on 1 Jan 2024, local

    expect(localYear(time)).toBe(2024)
  })
})

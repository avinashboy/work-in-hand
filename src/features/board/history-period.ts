import type { YearSpan } from './board-model'

/**
 * "Year or month" in History's search: a calendar year, or one month of it,
 * in the viewer's own time zone. It travels as a plain start and end time, so
 * the server needs no idea of time zones.
 */

export interface HistoryPeriod {
  readonly year: number
  /** 0 for January through 11 for December; null for the whole year. */
  readonly month: number | null
}

/** Start and end of a period in local time, both included. */
export function periodBounds({ year, month }: HistoryPeriod): { from: number; to: number } {
  const firstMonth = month ?? 0
  const lastMonth = month ?? 11
  return {
    from: new Date(year, firstMonth, 1).getTime(),
    to: new Date(year, lastMonth + 1, 1).getTime() - 1,
  }
}

/** Reads a period back from its start and end, as the viewer's clock sees them. */
export function periodFromBounds(from: number | null, to: number | null): HistoryPeriod | null {
  if (from === null) return null
  const start = new Date(from)
  const year = start.getFullYear()
  const wholeYear = periodBounds({ year, month: null })
  const isWholeYear = from === wholeYear.from && to === wholeYear.to
  return { year, month: isWholeYear ? null : start.getMonth() }
}

/**
 * Years with cards, in whatever time zone `yearOf` reads, newest first. Each
 * span's two ends land in the only years its cards can fall in.
 */
export function yearsWithCards(
  spans: readonly YearSpan[],
  yearOf: (time: number) => number,
): readonly number[] {
  const years = new Set(spans.flatMap(({ first, last }) => [yearOf(first), yearOf(last)]))
  return [...years].sort((a, b) => b - a)
}

/**
 * The Year box's choices: years with cards, plus a chosen year from the
 * address so it stays selected. This year alone when History is empty.
 */
export function historyYears(
  cardYears: readonly number[],
  thisYear: number,
  chosenYear?: number,
): readonly number[] {
  const years = new Set([...cardYears, ...(chosenYear === undefined ? [] : [chosenYear])])
  return years.size === 0 ? [thisYear] : [...years].sort((a, b) => b - a)
}

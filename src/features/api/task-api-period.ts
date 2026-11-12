import { z } from 'zod'
import { monthsBefore } from '../board/history-filter'

/**
 * `year` and `month` for listing cards: "what moved to History in November
 * 2025". They become a start and end time in UTC, like the API's dates.
 */

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const

const MIN_YEAR = 1970
const MAX_YEAR = 9999
const SHORT_NAME_LENGTH = 3

export const YEAR_ERROR = `must be a year like 2025, from ${MIN_YEAR} to ${MAX_YEAR}`
export const MONTH_ERROR = 'must be 1 to 12, or a month name like November or Nov'
export const MONTH_NEEDS_YEAR = 'month needs a year, as in year=2025&month=11'
export const PERIOD_CONFLICTS =
  'year and month already set when cards moved to History, so leave out archivedAfter, archivedBefore and archived=false'

/** "2025" from a URL or 2025 from an MCP call. */
export const yearSchema = z.coerce
  .number({ error: YEAR_ERROR })
  .int(YEAR_ERROR)
  .min(MIN_YEAR, YEAR_ERROR)
  .max(MAX_YEAR, YEAR_ERROR)

/** 1 to 12, or a month's English name or first three letters, in any case. Returns 1 to 12. */
export const monthSchema = z.union([z.string(), z.number()]).transform((value, context): number => {
  const text = String(value).trim().toLowerCase()
  const byNumber = /^\d{1,2}$/.test(text) ? Number(text) : Number.NaN
  const byName =
    MONTH_NAMES.findIndex(
      (name) => name === text || (text.length === SHORT_NAME_LENGTH && name.startsWith(text)),
    ) + 1
  const month = byNumber >= 1 && byNumber <= 12 ? byNumber : byName
  if (month === 0) {
    context.addIssue({ code: 'custom', message: MONTH_ERROR })
    return z.NEVER
  }
  return month
})

/** Start (included) and end (left out) of a year, or of one month of it, in UTC. */
export function periodRange(year: number, month: number | null): { after: number; before: number } {
  const startMonth = month === null ? 0 : month - 1
  const months = month === null ? 12 : 1
  return {
    after: Date.UTC(year, startMonth, 1),
    before: Date.UTC(year, startMonth + months, 1),
  }
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DAYS = 3650
const MAX_MONTHS = 120
const DAYS_PER_WEEK = 7
const WITHIN_FORMAT = /^(\d{1,5})\s*(d|days?|w|weeks?|m|months?)$/

export const WITHIN_ERROR = `must be a number of days, weeks or months, like 7d, 2w or 3m (up to ${MAX_DAYS} days or ${MAX_MONTHS} months)`
export const WITHIN_CONFLICTS =
  'within already sets when cards moved to History, so leave out year, month, archivedAfter, archivedBefore and archived=false'

export interface Within {
  readonly amount: number
  readonly unit: 'days' | 'months'
}

/** "7d", "30 days", "2w", "3 weeks", "5m" or "7 months": how far back to look. Weeks become days. */
export const withinSchema = z.string().transform((value, context): Within => {
  const match = WITHIN_FORMAT.exec(value.trim().toLowerCase())
  const letter = match?.[2][0]
  const amount = (match ? Number(match[1]) : 0) * (letter === 'w' ? DAYS_PER_WEEK : 1)
  const unit = letter === 'm' ? 'months' : 'days'
  const limit = unit === 'days' ? MAX_DAYS : MAX_MONTHS
  if (!match || amount < 1 || amount > limit) {
    context.addIssue({ code: 'custom', message: WITHIN_ERROR })
    return z.NEVER
  }
  return { amount, unit }
})

/** The start of the last few days or months, counted back from `now` like History's own choices. */
export function withinStart({ amount, unit }: Within, now: number): number {
  return unit === 'days' ? now - amount * DAY_MS : monthsBefore(now, amount)
}

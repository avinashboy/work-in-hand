import { z } from 'zod'
import { archivePageSchema, archivePageSizeSchema } from './board-model'

/**
 * Searching History: words in the title, and when the card moved to History.
 * Shared by the page, the server function and the database query.
 */

export const HISTORY_RANGES = ['all', '7d', '30d', '3m', '6m', '12m', 'custom'] as const
export type HistoryRange = (typeof HISTORY_RANGES)[number]

export const HISTORY_RANGE_LABELS: Readonly<Record<HistoryRange, string>> = {
  all: 'Any time',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  custom: 'Custom range',
}

export const MAX_HISTORY_SEARCH_LENGTH = 100

export interface HistoryFilter {
  /** Words to find in card titles. Empty means any title. */
  readonly search: string
  readonly range: HistoryRange
  /** Custom range only: start and end, in milliseconds, both included. */
  readonly from: number | null
  readonly to: number | null
}

export const NO_HISTORY_FILTER: HistoryFilter = { search: '', range: 'all', from: null, to: null }

// Up to the largest time a JavaScript Date can hold.
const MAX_TIME = 8_640_000_000_000_000
export const historyTimeSchema = z.number().int().min(0).max(MAX_TIME)

export const historyFilterSchema = z.object({
  search: z.string().trim().max(MAX_HISTORY_SEARCH_LENGTH),
  range: z.enum(HISTORY_RANGES),
  from: historyTimeSchema.nullable(),
  to: historyTimeSchema.nullable(),
})

export const archiveQuerySchema = z.object({
  page: archivePageSchema,
  pageSize: archivePageSizeSchema,
  filter: historyFilterSchema,
})

export type ArchiveQuery = z.infer<typeof archiveQuerySchema>

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS_BACK: Partial<Record<HistoryRange, number>> = { '7d': 7, '30d': 30 }
const MONTHS_BACK: Partial<Record<HistoryRange, number>> = { '3m': 3, '6m': 6, '12m': 12 }

/** Same day of the month, or the month's last day if it's shorter: 31 May → 28 Feb. */
function monthsBefore(now: number, months: number): number {
  const date = new Date(now)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  return date.setUTCDate(Math.min(day, lastDay))
}

export interface HistoryBounds {
  readonly after: number | null
  readonly before: number | null
}

/** Turns a filter into start and end times. Presets count back from `now`. */
export function resolveHistoryBounds(filter: HistoryFilter, now: number): HistoryBounds {
  const days = DAYS_BACK[filter.range]
  if (days !== undefined) return { after: now - days * DAY_MS, before: null }

  const months = MONTHS_BACK[filter.range]
  if (months !== undefined) return { after: monthsBefore(now, months), before: null }

  if (filter.range !== 'custom') return { after: null, before: null }

  const { from, to } = filter
  if (from !== null && to !== null && from > to) return { after: to, before: from }
  return { after: from, before: to }
}

export function isHistoryFiltered(filter: HistoryFilter): boolean {
  return filter.search.trim() !== '' || filter.range !== 'all'
}

import { z } from 'zod'
import { ARCHIVE_PAGE_SIZE, archivePageSchema, archivePageSizeSchema, type ArchivePageSize } from './board-model'
import {
  HISTORY_RANGES,
  MAX_HISTORY_SEARCH_LENGTH,
  hasOwnBounds,
  historyTimeSchema,
  type HistoryFilter,
} from './history-filter'

/**
 * History's filter lives in the address (?q=invoice&range=6m), so a search
 * survives a reload and can be bookmarked. Bad values are dropped, not fatal.
 */
export const historySearchSchema = z.object({
  page: archivePageSchema.optional().catch(undefined),
  size: archivePageSizeSchema.optional().catch(undefined),
  // The router reads ?q=2025 as a number, so numbers are turned back into words.
  q: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().max(MAX_HISTORY_SEARCH_LENGTH))
    .optional()
    .catch(undefined),
  range: z.enum(HISTORY_RANGES).optional().catch(undefined),
  from: historyTimeSchema.optional().catch(undefined),
  to: historyTimeSchema.optional().catch(undefined),
})

export type HistorySearch = z.infer<typeof historySearchSchema>

export function filterFromSearch(search: HistorySearch): HistoryFilter {
  const range = search.range ?? 'all'
  const isCustom = hasOwnBounds(range)
  return {
    search: search.q?.trim() ?? '',
    range,
    from: isCustom ? (search.from ?? null) : null,
    to: isCustom ? (search.to ?? null) : null,
  }
}

export function pageSizeFromSearch(search: HistorySearch): ArchivePageSize {
  return search.size ?? ARCHIVE_PAGE_SIZE
}

/** The address for a filter, leaving out anything at its default. Starts on page 1. */
export function searchFromFilter(filter: HistoryFilter): Omit<HistorySearch, 'page' | 'size'> {
  const search = filter.search.trim()
  const isCustom = hasOwnBounds(filter.range)
  return {
    ...(search ? { q: search } : {}),
    ...(filter.range === 'all' ? {} : { range: filter.range }),
    ...(isCustom && filter.from !== null ? { from: filter.from } : {}),
    ...(isCustom && filter.to !== null ? { to: filter.to } : {}),
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** A time as a date-time box shows it, in the viewer's own time zone. */
export function toLocalInputValue(time: number): string {
  const date = new Date(time)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A date-time box's value, read in the viewer's own time zone. */
export function fromLocalInputValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

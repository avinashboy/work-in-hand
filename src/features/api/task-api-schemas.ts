import { z } from 'zod'
import {
  MAX_NOTES_LENGTH,
  MAX_TASKS_ON_BOARD,
  taskTitleSchema,
  type ColumnId,
} from '../board/board-model'
import type { TaskPatch } from '../board/board-task-operations.server'
import { TASK_SORTS, type TaskQuery } from '../board/board-task-queries.server'
import {
  MONTH_NEEDS_YEAR,
  PERIOD_CONFLICTS,
  WITHIN_CONFLICTS,
  monthSchema,
  periodRange,
  withinSchema,
  withinStart,
  yearSchema,
  type Within,
} from './task-api-period'

const MAX_SEARCH_LENGTH = 200
const MAX_PAGE = 1_000_000
const MAX_PAGE_SIZE = 200
const DEFAULT_PAGE_SIZE = 50
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/

const OPEN_COLUMNS: ReadonlyMap<string, ColumnId> = new Map([
  ['backlog', 'backlog'],
  ['in progress', 'doing'],
  ['progress', 'doing'],
  ['doing', 'doing'],
  ['in review', 'review'],
  ['review', 'review'],
])
const ALL_COLUMNS: ReadonlyMap<string, ColumnId> = new Map([...OPEN_COLUMNS, ['done', 'done']])

const INVALID_OPEN_COLUMN = 'column must be Backlog, In progress or In review'
const INVALID_COLUMN = 'column must be Backlog, In progress, In review or Done'

function columnSchema(columns: ReadonlyMap<string, ColumnId>, error: string) {
  return z.string({ error }).transform((value, context): ColumnId => {
    const columnId = columns.get(value.trim().toLowerCase().replace(/[\s_-]+/g, ' '))
    if (columnId === undefined) {
      context.addIssue({ code: 'custom', message: error })
      return z.NEVER
    }
    return columnId
  })
}

const notesSchema = z.string().trim().max(MAX_NOTES_LENGTH)
const anyColumnSchema = columnSchema(ALL_COLUMNS, INVALID_COLUMN)

export const createTaskRequestSchema = z.object({
  title: taskTitleSchema,
  column: columnSchema(OPEN_COLUMNS, INVALID_OPEN_COLUMN).optional(),
  notes: notesSchema.default(''),
})

export const updateTaskRequestSchema = z
  .strictObject({
    title: taskTitleSchema.optional(),
    notes: notesSchema.optional(),
    column: anyColumnSchema.optional(),
    position: z.number().int().min(0).max(MAX_TASKS_ON_BOARD).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    error: 'Send at least one of title, notes, column or position',
  })
  .transform(({ column, ...rest }): TaskPatch =>
    column === undefined ? rest : { ...rest, columnId: column },
  )

const dateSchema = z
  .string()
  .regex(DATE_FORMAT, 'must be a date like 2026-11-09 or 2026-11-09T14:30:00Z')
  .transform((value) => Date.parse(value))
  .refine(Number.isFinite, 'must be a real date')

const columnListSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(anyColumnSchema))
  .transform((columns) => [...new Set(columns)])

interface PeriodQuery {
  readonly year?: number
  readonly month?: number
  readonly within?: Within
}

/** When `within` or a year asks for a stretch of History: its start and end, or null. */
function historyPeriod({
  year,
  month,
  within,
}: PeriodQuery): { after: number; before: number | null } | null {
  if (within !== undefined) return { after: withinStart(within, Date.now()), before: null }
  return year === undefined ? null : periodRange(year, month ?? null)
}

/** Strict, so a misspelt filter is refused instead of silently returning everything. */
export const listTasksQuerySchema = z
  .strictObject({
    status: z.enum(['ongoing', 'completed', 'all']).default('all'),
    column: columnListSchema.default([]),
    archived: z.enum(['true', 'false']).optional(),
    search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
    createdAfter: dateSchema.optional(),
    createdBefore: dateSchema.optional(),
    doneAfter: dateSchema.optional(),
    doneBefore: dateSchema.optional(),
    archivedAfter: dateSchema.optional(),
    archivedBefore: dateSchema.optional(),
    year: yearSchema.optional(),
    month: monthSchema.optional(),
    within: withinSchema.optional(),
    sort: z.enum(TASK_SORTS).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .superRefine((query, context) => {
    if (query.month !== undefined && query.year === undefined) {
      context.addIssue({ code: 'custom', message: MONTH_NEEDS_YEAR })
    }
    const hasOwnRange =
      query.archivedAfter !== undefined || query.archivedBefore !== undefined || query.archived === 'false'
    if (query.within !== undefined && (hasOwnRange || query.year !== undefined)) {
      context.addIssue({ code: 'custom', message: WITHIN_CONFLICTS })
    } else if (query.year !== undefined && hasOwnRange) {
      context.addIssue({ code: 'custom', message: PERIOD_CONFLICTS })
    }
  })
  .transform((query): TaskQuery => {
    // A year, month or `within` means "what moved to History then", newest first unless a sort is chosen.
    const period = historyPeriod(query)
    const archived = query.archived === undefined ? null : query.archived === 'true'
    return {
      status: query.status,
      columns: query.column,
      archived: period ? true : archived,
      search: query.search ?? null,
      createdAfter: query.createdAfter ?? null,
      createdBefore: query.createdBefore ?? null,
      doneAfter: query.doneAfter ?? null,
      doneBefore: query.doneBefore ?? null,
      archivedAfter: period ? period.after : (query.archivedAfter ?? null),
      archivedBefore: period ? period.before : (query.archivedBefore ?? null),
      sort: query.sort ?? (period ? 'archivedAt' : 'createdAt'),
      order: query.order,
      page: query.page,
      limit: query.limit,
    }
  })

export function describeProblem(error: z.ZodError): string {
  const [issue] = error.issues
  const field = issue.path.join('.')
  return !field || issue.message.startsWith('column ')
    ? issue.message
    : `${field}: ${issue.message}`
}

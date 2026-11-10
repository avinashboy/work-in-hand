import { z } from 'zod'
import type { SqlDatabase, SqlValue } from '../../lib/sql-database'
import {
  COLUMN_IDS,
  COLUMN_TITLES,
  type ArchiveReason,
  type ColumnId,
  type TaskEdit,
  type TaskMove,
} from './board-model'
import { readEdits } from './board-edits.server'

export const TASK_SORTS = ['createdAt', 'movedAt', 'doneAt', 'title'] as const
export type TaskSort = (typeof TASK_SORTS)[number]

export interface TaskQuery {
  readonly status: 'ongoing' | 'completed' | 'all'
  /** Empty means every column. */
  readonly columns: readonly ColumnId[]
  readonly archived: boolean | null
  readonly search: string | null
  readonly createdAfter: number | null
  readonly createdBefore: number | null
  readonly doneAfter: number | null
  readonly doneBefore: number | null
  readonly sort: TaskSort
  readonly order: 'asc' | 'desc'
  readonly page: number
  readonly limit: number
}

export interface StoredTask {
  readonly id: string
  readonly title: string
  readonly notes: string
  readonly columnId: ColumnId
  readonly createdAt: number
  readonly movedAt: number
  readonly doneAt: number | null
  readonly archivedAt: number | null
  readonly archiveReason: ArchiveReason | null
}

export interface StoredTaskDetail extends StoredTask {
  readonly moves: readonly TaskMove[]
  readonly edits: readonly TaskEdit[]
}

export interface TaskListPage {
  readonly tasks: readonly StoredTask[]
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly pageCount: number
}

export interface TaskSummary {
  readonly columns: readonly { readonly id: ColumnId; readonly title: string; readonly count: number }[]
  readonly ongoing: number
  readonly completed: number
  readonly archived: number
  readonly total: number
}

export type TaskChange =
  | { readonly outcome: 'changed'; readonly task: StoredTaskDetail }
  | { readonly outcome: 'missing' | 'history' | 'not-done' }

// Only these fixed strings ever reach ORDER BY, so a sort can't inject SQL.
const SORT_COLUMNS: Readonly<Record<TaskSort, string>> = {
  createdAt: 't.created_at',
  movedAt: 't.moved_at',
  doneAt: 't.done_at',
  title: 't.title COLLATE NOCASE',
}

const FROM_TASKS = 'FROM tasks t LEFT JOIN task_notes n ON n.task_id = t.id'
const SELECT_TASKS = `SELECT t.id, t.title, COALESCE(n.notes, '') AS notes, t.column_id,
  t.created_at, t.moved_at, t.done_at, t.archived_at, t.archive_reason ${FROM_TASKS}`

const taskRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  column_id: z.enum(COLUMN_IDS),
  created_at: z.number(),
  moved_at: z.number(),
  done_at: z.number().nullable(),
  archived_at: z.number().nullable(),
  archive_reason: z.enum(['confirmed', 'expired']).nullable(),
})

const moveRowSchema = z.object({ column_id: z.enum(COLUMN_IDS), at: z.number() })
const countRowSchema = z.object({ total: z.number() })
const columnCountRowSchema = z.object({ column_id: z.enum(COLUMN_IDS), count: z.number() })
const totalsRowSchema = z.object({
  ongoing: z.number(),
  completed: z.number(),
  archived: z.number(),
  total: z.number(),
})

interface Clause {
  readonly sql: string
  readonly params: readonly SqlValue[]
}

function toStoredTask(row: unknown): StoredTask {
  const parsed = taskRowSchema.parse(row)
  return {
    id: parsed.id,
    title: parsed.title,
    notes: parsed.notes,
    columnId: parsed.column_id,
    createdAt: parsed.created_at,
    movedAt: parsed.moved_at,
    doneAt: parsed.done_at,
    archivedAt: parsed.archived_at,
    archiveReason: parsed.archive_reason,
  }
}

function statusClauses(status: TaskQuery['status']): readonly Clause[] {
  if (status === 'ongoing') {
    return [{ sql: 't.done_at IS NULL AND t.archived_at IS NULL', params: [] }]
  }
  return status === 'completed' ? [{ sql: 't.done_at IS NOT NULL', params: [] }] : []
}

function columnClauses(columns: TaskQuery['columns']): readonly Clause[] {
  if (columns.length === 0) return []
  return [{ sql: `t.column_id IN (${columns.map(() => '?').join(', ')})`, params: columns }]
}

function archivedClauses(archived: boolean | null): readonly Clause[] {
  if (archived === null) return []
  return [{ sql: `t.archived_at IS ${archived ? 'NOT ' : ''}NULL`, params: [] }]
}

function searchClauses(search: string | null): readonly Clause[] {
  if (search === null) return []
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
  return [
    {
      sql: `(t.title LIKE ? ESCAPE '\\' OR COALESCE(n.notes, '') LIKE ? ESCAPE '\\')`,
      params: [pattern, pattern],
    },
  ]
}

function boundClauses(column: string, operator: '>=' | '<', bound: number | null): readonly Clause[] {
  return bound === null ? [] : [{ sql: `${column} ${operator} ?`, params: [bound] }]
}

function filterClauses(query: TaskQuery): readonly Clause[] {
  return [
    ...statusClauses(query.status),
    ...columnClauses(query.columns),
    ...archivedClauses(query.archived),
    ...searchClauses(query.search),
    ...boundClauses('t.created_at', '>=', query.createdAfter),
    ...boundClauses('t.created_at', '<', query.createdBefore),
    ...boundClauses('t.done_at', '>=', query.doneAfter),
    ...boundClauses('t.done_at', '<', query.doneBefore),
  ]
}

/** Searches the board and the history together. Every filter value is a bound parameter. */
export function listTasks(db: SqlDatabase, query: TaskQuery): TaskListPage {
  const clauses = filterClauses(query)
  const where = clauses.length ? `WHERE ${clauses.map(({ sql }) => sql).join(' AND ')}` : ''
  const params = clauses.flatMap((clause) => clause.params)
  const direction = query.order === 'asc' ? 'ASC' : 'DESC'

  const { total } = countRowSchema.parse(
    db.query(`SELECT COUNT(*) AS total ${FROM_TASKS} ${where}`, ...params)[0],
  )
  const tasks = db
    .query(
      `${SELECT_TASKS} ${where}
       ORDER BY ${SORT_COLUMNS[query.sort]} ${direction}, t.id ${direction}
       LIMIT ? OFFSET ?`,
      ...params,
      query.limit,
      (query.page - 1) * query.limit,
    )
    .map(toStoredTask)

  return {
    tasks,
    total,
    page: query.page,
    limit: query.limit,
    pageCount: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export function findTask(db: SqlDatabase, taskId: string): StoredTaskDetail | null {
  const [row] = db.query(`${SELECT_TASKS} WHERE t.id = ?`, taskId)
  if (row === undefined) return null

  const moves = db
    .query('SELECT column_id, at FROM task_moves WHERE task_id = ? ORDER BY at, id', taskId)
    .map((move) => moveRowSchema.parse(move))
    .map(({ column_id: columnId, at }) => ({ columnId, at }))

  const edits = readEdits(db, [taskId]).get(taskId) ?? []

  return { ...toStoredTask(row), moves, edits }
}

export function summarizeTasks(db: SqlDatabase): TaskSummary {
  const counts = new Map(
    db
      .query(
        `SELECT column_id, COUNT(*) AS count FROM tasks
         WHERE archived_at IS NULL GROUP BY column_id`,
      )
      .map((row) => columnCountRowSchema.parse(row))
      .map(({ column_id: columnId, count }) => [columnId, count] as const),
  )
  const totals = totalsRowSchema.parse(
    db.query(
      `SELECT COALESCE(SUM(done_at IS NULL AND archived_at IS NULL), 0) AS ongoing,
              COALESCE(SUM(done_at IS NOT NULL), 0) AS completed,
              COALESCE(SUM(archived_at IS NOT NULL), 0) AS archived,
              COUNT(*) AS total
       FROM tasks`,
    )[0],
  )

  return {
    columns: COLUMN_IDS.map((id) => ({
      id,
      title: COLUMN_TITLES[id],
      count: counts.get(id) ?? 0,
    })),
    ...totals,
  }
}

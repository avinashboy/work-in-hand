import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import {
  COLUMN_IDS,
  TASK_EDIT_KINDS,
  type Board,
  type ColumnId,
  type Task,
  type TaskEdit,
  type TaskEditKind,
} from './board-model'

// Its own table, so databases made before edits were recorded need no change elsewhere.
export const EDITS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS task_edits (
    id INTEGER PRIMARY KEY,
    task_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('title', 'notes-added', 'notes-changed', 'notes-removed')),
    column_id TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS task_edits_by_task ON task_edits (task_id, at);
`

const INSERT_EDIT = 'INSERT INTO task_edits (task_id, kind, column_id, at) VALUES (?, ?, ?, ?)'

const editRowSchema = z.object({
  task_id: z.string(),
  kind: z.enum(TASK_EDIT_KINDS),
  column_id: z.enum(COLUMN_IDS),
  at: z.number(),
})

interface Placed {
  readonly task: Task
  readonly columnId: ColumnId
}

function placedTasks(board: Board): readonly Placed[] {
  return board.columns.flatMap(({ id, tasks }) => tasks.map((task) => ({ task, columnId: id })))
}

function notesEditKind(before: string, after: string): TaskEditKind | null {
  if (before === after) return null
  if (before === '') return 'notes-added'
  return after === '' ? 'notes-removed' : 'notes-changed'
}

function editKinds(before: Task, after: Task): readonly TaskEditKind[] {
  const notesKind = notesEditKind(before.notes, after.notes)
  return [
    ...(before.title === after.title ? [] : (['title'] as const)),
    ...(notesKind === null ? [] : [notesKind]),
  ]
}

/**
 * Logs each title or notes change on a card that existed before and after.
 * New cards are skipped: their title and notes are part of being created.
 */
export function recordEdits(db: SqlDatabase, previous: Board, next: Board, at: number): void {
  const before = new Map(placedTasks(previous).map(({ task }) => [task.id, task] as const))
  for (const { task, columnId } of placedTasks(next)) {
    const old = before.get(task.id)
    if (old === undefined) continue
    editKinds(old, task).forEach((kind) => db.run(INSERT_EDIT, task.id, kind, columnId, at))
  }
}

export function deleteEdits(db: SqlDatabase, taskId: string): void {
  db.run('DELETE FROM task_edits WHERE task_id = ?', taskId)
}

/** Edits for each of the given cards, oldest first. */
export function readEdits(
  db: SqlDatabase,
  taskIds: readonly string[],
): ReadonlyMap<string, readonly TaskEdit[]> {
  if (taskIds.length === 0) return new Map()
  const placeholders = taskIds.map(() => '?').join(', ')
  const rows = db
    .query(
      `SELECT task_id, kind, column_id, at FROM task_edits
       WHERE task_id IN (${placeholders}) ORDER BY at, id`,
      ...taskIds,
    )
    .map((row) => editRowSchema.parse(row))

  return new Map(
    taskIds.map((id) => [
      id,
      rows
        .filter((row) => row.task_id === id)
        .map(({ kind, column_id: columnId, at }) => ({ kind, columnId, at })),
    ]),
  )
}

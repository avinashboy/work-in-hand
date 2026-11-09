import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import {
  ARCHIVE_AFTER_MS,
  ARCHIVE_PAGE_SIZE,
  COLUMN_IDS,
  COLUMN_TITLES,
  DONE_COLUMN_ID,
  MAX_TASKS_ON_BOARD,
  createTaskId,
  type ArchivePage,
  type Board,
  type BoardCommand,
  type ColumnId,
  type Task,
} from './board-model'
import { applyCommand, countTasks } from './board-reducer'
import { createTaskOperations, type TaskOperations } from './board-task-operations.server'

const NO_TASKS: Board = { columns: [] }

const SCHEMA = `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    column_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    moved_at INTEGER NOT NULL,
    done_at INTEGER,
    archived_at INTEGER,
    archive_reason TEXT CHECK (archive_reason IN ('confirmed', 'expired'))
  );
  CREATE INDEX tasks_by_archive_time ON tasks (archived_at);
  CREATE TABLE task_moves (
    id INTEGER PRIMARY KEY,
    task_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX task_moves_by_task ON task_moves (task_id, at);
`

// Its own table, so databases made before notes existed need no change to `tasks`.
const NOTES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS task_notes (
    task_id TEXT PRIMARY KEY,
    notes TEXT NOT NULL
  );
`

const INSERT_MOVE ='INSERT INTO task_moves (task_id, column_id, at) VALUES (?, ?, ?)'

const activeRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  column_id: z.enum(COLUMN_IDS),
  created_at: z.number(),
  moved_at: z.number(),
  done_at: z.number().nullable(),
})

const moveRowSchema = z.object({
  task_id: z.string(),
  column_id: z.enum(COLUMN_IDS),
  at: z.number(),
})

const archivedRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  created_at: z.number(),
  done_at: z.number(),
  archived_at: z.number(),
  archive_reason: z.enum(['confirmed', 'expired']),
})

const countRowSchema = z.object({ total: z.number() })

export interface BoardRepository extends TaskOperations {
  readonly get: () => Board
  readonly apply: (command: BoardCommand) => Board
  readonly listArchive: (page: number) => ArchivePage
  /** Only ever touches finished cards: one still on the board is left alone. */
  readonly deleteArchived: (taskId: string) => void
  /** Returns the new card, or null when the board is full. */
  readonly createTask: (input: NewTask) => Task | null
}

export interface NewTask {
  readonly columnId: ColumnId
  readonly title: string
  readonly notes: string
}

interface BoardRepositoryOptions {
  readonly db: SqlDatabase
  readonly now: () => number
  readonly seedBoard: Board
}

function saveTasks(db: SqlDatabase, board: Board): void {
  for (const column of board.columns) {
    column.tasks.forEach((task, position) => {
      db.run(
        `INSERT INTO tasks (id, title, column_id, position, created_at, moved_at, done_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title,
           column_id = excluded.column_id,
           position = excluded.position,
           moved_at = excluded.moved_at,
           done_at = excluded.done_at
         WHERE archived_at IS NULL`,
        task.id,
        task.title,
        column.id,
        position,
        task.createdAt,
        task.movedAt,
        task.doneAt,
      )
    })
  }
}

/** Logs each card that is in a different column than before, or is new. */
function recordMoves(db: SqlDatabase, previous: Board, next: Board): void {
  const columnBefore = new Map(
    previous.columns.flatMap(({ id, tasks }) =>
      tasks.map((task) => [task.id, id] as const),
    ),
  )
  for (const { id: columnId, tasks } of next.columns) {
    tasks
      .filter((task) => columnBefore.get(task.id) !== columnId)
      .forEach((task) => db.run(INSERT_MOVE, task.id, columnId, task.movedAt))
  }
}

function deleteNotes(db: SqlDatabase, taskId: string): void {
  db.run('DELETE FROM task_notes WHERE task_id = ?', taskId)
}

/** The EXISTS check means a finished card's notes can't be changed by reusing its id. */
function writeNotes(db: SqlDatabase, taskId: string, notes: string): void {
  if (notes === '') {
    deleteNotes(db, taskId)
    return
  }
  db.run(
    `INSERT INTO task_notes (task_id, notes)
     SELECT ?, ? WHERE EXISTS (SELECT 1 FROM tasks WHERE id = ? AND archived_at IS NULL)
     ON CONFLICT (task_id) DO UPDATE SET notes = excluded.notes`,
    taskId,
    notes,
    taskId,
  )
}

function saveChangedNotes(db: SqlDatabase, previous: Board, next: Board): void {
  const notesBefore = new Map(
    previous.columns.flatMap(({ tasks }) =>
      tasks.map((task) => [task.id, task.notes] as const),
    ),
  )
  next.columns
    .flatMap(({ tasks }) => tasks)
    .filter((task) => task.notes !== (notesBefore.get(task.id) ?? ''))
    .forEach((task) => writeNotes(db, task.id, task.notes))
}

function setUpSchema(db: SqlDatabase, seedBoard: Board): void {
  db.transaction(() => {
    db.script(NOTES_SCHEMA)
    const isNewDatabase =
      db.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
        .length === 0
    if (!isNewDatabase) return

    db.script(SCHEMA)
    saveTasks(db, seedBoard)
    recordMoves(db, NO_TASKS, seedBoard)
  })
}

/** Runs on every read and write, so a card can never outstay its 24 hours. */
function archiveExpiredTasks(db: SqlDatabase, now: number): void {
  db.run(
    `UPDATE tasks
     SET archived_at = done_at + ?, archive_reason = 'expired'
     WHERE archived_at IS NULL AND column_id = ? AND done_at <= ?`,
    ARCHIVE_AFTER_MS,
    DONE_COLUMN_ID,
    now - ARCHIVE_AFTER_MS,
  )
}

function loadBoard(db: SqlDatabase): Board {
  const rows = db
    .query(
      `SELECT t.id, t.title, COALESCE(n.notes, '') AS notes, t.column_id,
              t.created_at, t.moved_at, t.done_at
       FROM tasks t LEFT JOIN task_notes n ON n.task_id = t.id
       WHERE t.archived_at IS NULL ORDER BY t.position`,
    )
    .map((row) => activeRowSchema.parse(row))

  return {
    columns: COLUMN_IDS.map((id) => ({
      id,
      title: COLUMN_TITLES[id],
      tasks: rows
        .filter((row) => row.column_id === id)
        .map((row) => ({
          id: row.id,
          title: row.title,
          notes: row.notes,
          createdAt: row.created_at,
          movedAt: row.moved_at,
          doneAt: row.done_at,
        })),
    })),
  }
}

function withServerTime(command: BoardCommand, now: number): BoardCommand {
  return 'at' in command ? { ...command, at: now } : command
}

function taskIds(board: Board): string[] {
  return board.columns.flatMap(({ tasks }) => tasks.map(({ id }) => id))
}

function removeMissingTasks(
  db: SqlDatabase,
  previous: Board,
  next: Board,
  command: BoardCommand,
  now: number,
): void {
  const remaining = new Set(taskIds(next))
  const remove =
    command.type === 'archive'
      ? (id: string) => {
          db.run(
            `UPDATE tasks SET archived_at = ?, archive_reason = 'confirmed'
             WHERE id = ?`,
            now,
            id,
          )
        }
      : (id: string) => {
          db.run('DELETE FROM task_moves WHERE task_id = ?', id)
          deleteNotes(db, id)
          db.run('DELETE FROM tasks WHERE id = ?', id)
        }

  taskIds(previous)
    .filter((id) => !remaining.has(id))
    .forEach(remove)
}

function readMoves(db: SqlDatabase, taskIds: readonly string[]) {
  const placeholders = taskIds.map(() => '?').join(', ')
  return db
    .query(
      `SELECT task_id, column_id, at FROM task_moves
       WHERE task_id IN (${placeholders}) ORDER BY at, id`,
      ...taskIds,
    )
    .map((row) => moveRowSchema.parse(row))
}

function readArchivePage(db: SqlDatabase, requestedPage: number): ArchivePage {
  const { total } = countRowSchema.parse(
    db.query('SELECT COUNT(*) AS total FROM tasks WHERE archived_at IS NOT NULL')[0],
  )
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const rows = db
    .query(
      `SELECT t.id, t.title, COALESCE(n.notes, '') AS notes, t.created_at,
              t.done_at, t.archived_at, t.archive_reason
       FROM tasks t LEFT JOIN task_notes n ON n.task_id = t.id
       WHERE t.archived_at IS NOT NULL
       ORDER BY t.archived_at DESC, t.id DESC LIMIT ? OFFSET ?`,
      ARCHIVE_PAGE_SIZE,
      (page - 1) * ARCHIVE_PAGE_SIZE,
    )
    .map((row) => archivedRowSchema.parse(row))
  const moves = readMoves(db, rows.map(({ id }) => id))
  const tasks = rows.map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    createdAt: row.created_at,
    doneAt: row.done_at,
    archivedAt: row.archived_at,
    reason: row.archive_reason,
    moves: moves
      .filter((move) => move.task_id === row.id)
      .map(({ column_id: columnId, at }) => ({ columnId, at })),
  }))

  return { tasks, page, pageCount, total }
}

/** All board storage. Creates any missing tables, so call it once at start-up. */
export function createBoardRepository({
  db,
  now,
  seedBoard,
}: BoardRepositoryOptions): BoardRepository {
  setUpSchema(db, seedBoard)

  const get = (): Board =>
    db.transaction(() => {
      archiveExpiredTasks(db, now())
      return loadBoard(db)
    })

  const applyChange = (command: BoardCommand): Board => {
    const time = now()
    archiveExpiredTasks(db, time)
    const previous = loadBoard(db)
    const next = applyCommand(previous, withServerTime(command, time))
    if (command.type === 'create' && countTasks(next) > MAX_TASKS_ON_BOARD) {
      throw new Error('Board is full')
    }
    saveTasks(db, next)
    removeMissingTasks(db, previous, next, command, time)
    saveChangedNotes(db, previous, next)
    // Compared with what was really saved: an archived id can't be revived.
    const saved = loadBoard(db)
    recordMoves(db, previous, saved)
    return saved
  }

  const apply = (command: BoardCommand): Board => db.transaction(() => applyChange(command))

  const removeFromHistory = (taskId: string): void => {
    const removed = db.run('DELETE FROM tasks WHERE id = ? AND archived_at IS NOT NULL', taskId)
    if (removed === 0) return
    db.run('DELETE FROM task_moves WHERE task_id = ?', taskId)
    deleteNotes(db, taskId)
  }

  return {
    ...createTaskOperations({
      db,
      now,
      sweepExpired: () => archiveExpiredTasks(db, now()),
      applyChange,
      removeFromHistory,
    }),
    get,
    apply,
    createTask: ({ columnId, title, notes }) => {
      if (countTasks(get()) >= MAX_TASKS_ON_BOARD) return null
      const taskId = createTaskId()
      const board = apply({ type: 'create', taskId, columnId, title, notes, at: now() })
      return (
        board.columns.flatMap(({ tasks }) => tasks).find(({ id }) => id === taskId) ?? null
      )
    },
    listArchive: (page) =>
      db.transaction(() => {
        archiveExpiredTasks(db, now())
        return readArchivePage(db, page)
      }),
    deleteArchived: (taskId) => db.transaction(() => removeFromHistory(taskId)),
  }
}

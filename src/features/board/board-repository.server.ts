import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import {
  getDatabasePath,
  inTransaction,
  openDatabase,
} from '../../lib/sqlite.server'
import {
  ARCHIVE_AFTER_MS,
  ARCHIVE_PAGE_SIZE,
  COLUMN_IDS,
  COLUMN_TITLES,
  DONE_COLUMN_ID,
  MAX_TASKS_ON_BOARD,
  createSeedBoard,
  type ArchivePage,
  type Board,
  type BoardCommand,
} from './board-model'
import { applyCommand, countTasks } from './board-reducer'

const SCHEMA_VERSION = 2
const NO_TASKS: Board = { columns: [] }

const SCHEMA = `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    column_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    done_at INTEGER,
    archived_at INTEGER,
    archive_reason TEXT CHECK (archive_reason IN ('confirmed', 'expired'))
  );
  CREATE INDEX tasks_by_archive_time ON tasks (archived_at);
`

// Older cards only know when they were added and finished, so nothing else is
// made up for them: a card in the middle of the board counts as not yet moved.
const ADD_MOVE_TRACKING = `
  ALTER TABLE tasks ADD COLUMN moved_at INTEGER NOT NULL DEFAULT 0;
  UPDATE tasks SET moved_at = COALESCE(done_at, created_at);
  CREATE TABLE task_moves (
    id INTEGER PRIMARY KEY,
    task_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX task_moves_by_task ON task_moves (task_id, at);
  INSERT INTO task_moves (task_id, column_id, at)
    SELECT id, '${DONE_COLUMN_ID}', done_at FROM tasks WHERE done_at IS NOT NULL;
`

const activeRowSchema = z.object({
  id: z.string(),
  title: z.string(),
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
  created_at: z.number(),
  done_at: z.number(),
  archived_at: z.number(),
  archive_reason: z.enum(['confirmed', 'expired']),
})

const versionRowSchema = z.object({ user_version: z.number() })
const countRowSchema = z.object({ total: z.number() })

export interface BoardRepository {
  get: () => Board
  apply: (command: BoardCommand) => Board
  listArchive: (page: number) => ArchivePage
  /** Only ever touches finished cards: one still on the board is left alone. */
  deleteArchived: (taskId: string) => void
  close: () => void
}

interface BoardRepositoryOptions {
  readonly path: string
  readonly now: () => number
  readonly seedBoard: Board
}

function saveTasks(db: DatabaseSync, board: Board): void {
  const upsert = db.prepare(`
    INSERT INTO tasks (id, title, column_id, position, created_at, moved_at, done_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      column_id = excluded.column_id,
      position = excluded.position,
      moved_at = excluded.moved_at,
      done_at = excluded.done_at
    WHERE archived_at IS NULL
  `)
  for (const column of board.columns) {
    column.tasks.forEach((task, position) => {
      upsert.run(
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
function recordMoves(db: DatabaseSync, previous: Board, next: Board): void {
  const columnBefore = new Map(
    previous.columns.flatMap(({ id, tasks }) =>
      tasks.map((task) => [task.id, id] as const),
    ),
  )
  const insert = db.prepare(
    'INSERT INTO task_moves (task_id, column_id, at) VALUES (?, ?, ?)',
  )
  for (const { id: columnId, tasks } of next.columns) {
    tasks
      .filter((task) => columnBefore.get(task.id) !== columnId)
      .forEach((task) => insert.run(task.id, columnId, task.movedAt))
  }
}

function setUpSchema(db: DatabaseSync, seedBoard: Board): void {
  // Checked inside the write lock so two processes can't both create the table.
  inTransaction(db, () => {
    const { user_version: version } = versionRowSchema.parse(
      db.prepare('PRAGMA user_version').get(),
    )
    if (version >= SCHEMA_VERSION) return

    const isNewDatabase = version === 0
    if (isNewDatabase) db.exec(SCHEMA)
    db.exec(ADD_MOVE_TRACKING)
    if (isNewDatabase) {
      saveTasks(db, seedBoard)
      recordMoves(db, NO_TASKS, seedBoard)
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })
}

/** Runs on every read and write, so a card can never outstay its 24 hours. */
function archiveExpiredTasks(db: DatabaseSync, now: number): void {
  db.prepare(
    `UPDATE tasks
     SET archived_at = done_at + ?, archive_reason = 'expired'
     WHERE archived_at IS NULL AND column_id = ? AND done_at <= ?`,
  ).run(ARCHIVE_AFTER_MS, DONE_COLUMN_ID, now - ARCHIVE_AFTER_MS)
}

function loadBoard(db: DatabaseSync): Board {
  const rows = db
    .prepare(
      `SELECT id, title, column_id, created_at, moved_at, done_at FROM tasks
       WHERE archived_at IS NULL ORDER BY position`,
    )
    .all()
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
  db: DatabaseSync,
  previous: Board,
  next: Board,
  command: BoardCommand,
  now: number,
): void {
  const remaining = new Set(taskIds(next))
  const remove =
    command.type === 'archive'
      ? (id: string) =>
          db
            .prepare(
              `UPDATE tasks SET archived_at = ?, archive_reason = 'confirmed'
               WHERE id = ?`,
            )
            .run(now, id)
      : (id: string) => {
          db.prepare('DELETE FROM task_moves WHERE task_id = ?').run(id)
          db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
        }

  taskIds(previous)
    .filter((id) => !remaining.has(id))
    .forEach(remove)
}

function readMoves(db: DatabaseSync, taskIds: readonly string[]) {
  const placeholders = taskIds.map(() => '?').join(', ')
  return db
    .prepare(
      `SELECT task_id, column_id, at FROM task_moves
       WHERE task_id IN (${placeholders}) ORDER BY at, id`,
    )
    .all(...taskIds)
    .map((row) => moveRowSchema.parse(row))
}

function readArchivePage(db: DatabaseSync, requestedPage: number): ArchivePage {
  const { total } = countRowSchema.parse(
    db
      .prepare('SELECT COUNT(*) AS total FROM tasks WHERE archived_at IS NOT NULL')
      .get(),
  )
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const rows = db
    .prepare(
      `SELECT id, title, created_at, done_at, archived_at, archive_reason
       FROM tasks WHERE archived_at IS NOT NULL
       ORDER BY archived_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(ARCHIVE_PAGE_SIZE, (page - 1) * ARCHIVE_PAGE_SIZE)
    .map((row) => archivedRowSchema.parse(row))
  const moves = readMoves(db, rows.map(({ id }) => id))
  const tasks = rows.map((row) => ({
    id: row.id,
    title: row.title,
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

export function createBoardRepository({
  path,
  now,
  seedBoard,
}: BoardRepositoryOptions): BoardRepository {
  const db = openDatabase(path)
  setUpSchema(db, seedBoard)

  return {
    get: () =>
      inTransaction(db, () => {
        archiveExpiredTasks(db, now())
        return loadBoard(db)
      }),
    apply: (command) =>
      inTransaction(db, () => {
        const time = now()
        archiveExpiredTasks(db, time)
        const previous = loadBoard(db)
        const next = applyCommand(previous, withServerTime(command, time))
        if (command.type === 'create' && countTasks(next) > MAX_TASKS_ON_BOARD) {
          throw new Error('Board is full')
        }
        saveTasks(db, next)
        removeMissingTasks(db, previous, next, command, time)
        // Compared with what was really saved: an archived id can't be revived.
        const saved = loadBoard(db)
        recordMoves(db, previous, saved)
        return saved
      }),
    listArchive: (page) =>
      inTransaction(db, () => {
        archiveExpiredTasks(db, now())
        return readArchivePage(db, page)
      }),
    deleteArchived: (taskId) =>
      inTransaction(db, () => {
        const { changes } = db
          .prepare('DELETE FROM tasks WHERE id = ? AND archived_at IS NOT NULL')
          .run(taskId)
        if (Number(changes) === 0) return
        db.prepare('DELETE FROM task_moves WHERE task_id = ?').run(taskId)
      }),
    close: () => db.close(),
  }
}

let sharedRepository: BoardRepository | undefined

/** Opens the database on first use, so importing this never touches disk. */
export function getBoardRepository(): BoardRepository {
  sharedRepository ??= createBoardRepository({
    path: getDatabasePath(),
    now: Date.now,
    seedBoard: createSeedBoard(Date.now()),
  })
  return sharedRepository
}

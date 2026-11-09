import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import type { BoardCommand } from '../board/board-model'
import {
  createBoardRepository,
  type BoardRepository,
} from '../board/board-repository.server'
import {
  DEMO_CARD_LIFETIME_MS,
  DEMO_MAX_CARDS,
  DEMO_MAX_WRITES_PER_DAY,
} from './demo-config'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const USAGE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS demo_usage (
    day INTEGER PRIMARY KEY,
    writes INTEGER NOT NULL
  );
`

const oldestRowSchema = z.object({ oldest: z.number().nullable() })
const countRowSchema = z.object({ total: z.number() })

export interface DemoBoard extends BoardRepository {
  /** Removes every card past its lifetime, on the board and in History. */
  readonly deleteExpired: () => void
  /** When the oldest card is due to go, or null when there are no cards. */
  readonly nextExpiry: () => number | null
}

interface DemoBoardOptions {
  readonly db: SqlDatabase
  readonly now: () => number
}

function deleteCardsCreatedBy(db: SqlDatabase, cutoff: number): void {
  db.transaction(() => {
    const expired = 'SELECT id FROM tasks WHERE created_at <= ?'
    db.run(`DELETE FROM task_moves WHERE task_id IN (${expired})`, cutoff)
    db.run(`DELETE FROM task_notes WHERE task_id IN (${expired})`, cutoff)
    db.run('DELETE FROM tasks WHERE created_at <= ?', cutoff)
  })
}

/** Kept out of the save's transaction, so refused saves still use up the budget. */
function spendWrite(db: SqlDatabase, time: number): void {
  const day = Math.floor(time / ONE_DAY_MS)
  db.run('DELETE FROM demo_usage WHERE day < ?', day)
  const changed = db.run(
    `INSERT INTO demo_usage (day, writes) VALUES (?, 1)
     ON CONFLICT (day) DO UPDATE SET writes = writes + 1 WHERE writes < ?`,
    day,
    DEMO_MAX_WRITES_PER_DAY,
  )
  if (changed === 0) throw new Error('Demo daily limit reached')
}

function assertRoomForNewCard(db: SqlDatabase): void {
  const { total } = countRowSchema.parse(
    db.query('SELECT COUNT(*) AS total FROM tasks')[0],
  )
  if (total >= DEMO_MAX_CARDS) throw new Error('Demo board is full')
}

/**
 * The normal board with the public demo's rules on top. Expired cards are
 * cleared before every read and write, so none can be seen past its lifetime.
 */
export function createDemoBoard({ db, now }: DemoBoardOptions): DemoBoard {
  db.script(USAGE_SCHEMA)
  const repository = createBoardRepository({ db, now, seedBoard: { columns: [] } })

  const nextExpiry = (): number | null => {
    const { oldest } = oldestRowSchema.parse(
      db.query('SELECT MIN(created_at) AS oldest FROM tasks')[0],
    )
    return oldest === null ? null : oldest + DEMO_CARD_LIFETIME_MS
  }

  /** Runs on every request, so it does the rows-read-heavy deletes only when due. */
  const deleteExpired = () => {
    const expiry = nextExpiry()
    if (expiry === null || now() < expiry) return
    deleteCardsCreatedBy(db, now() - DEMO_CARD_LIFETIME_MS)
  }

  const prepareWrite = () => {
    deleteExpired()
    spendWrite(db, now())
  }

  return {
    ...repository,
    deleteExpired,
    nextExpiry,
    get: () => {
      deleteExpired()
      return repository.get()
    },
    apply: (command: BoardCommand) => {
      prepareWrite()
      if (command.type === 'create') assertRoomForNewCard(db)
      return repository.apply(command)
    },
    listArchive: (page) => {
      deleteExpired()
      return repository.listArchive(page)
    },
    deleteArchived: (taskId) => {
      prepareWrite()
      repository.deleteArchived(taskId)
    },
  }
}

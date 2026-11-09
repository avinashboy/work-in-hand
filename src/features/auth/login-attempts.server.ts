import type { SqlDatabase } from '../../lib/sql-database'
import {
  LOGIN_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS,
  MAX_LOGIN_ATTEMPTS_ALL_CLIENTS,
} from './login-model'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS login_attempts (
    client TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    window_started_at INTEGER NOT NULL
  );
`

// Never a real client key, which is always an IP address or network.
const ALL_CLIENTS = '*'

export interface LoginAttempts {
  /** Counts a try before the password is checked, so parallel guesses can't slip in. */
  readonly reserve: (client: string) => boolean
  readonly clear: (client: string) => void
}

interface LoginAttemptsOptions {
  readonly db: SqlDatabase
  readonly now: () => number
}

function attemptsUsed(db: SqlDatabase, client: string): number {
  const [row] = db.query('SELECT attempts FROM login_attempts WHERE client = ?', client)
  return row ? Number(row.attempts) : 0
}

function countAttempt(db: SqlDatabase, client: string, time: number): void {
  db.run(
    `INSERT INTO login_attempts (client, attempts, window_started_at) VALUES (?, 1, ?)
     ON CONFLICT (client) DO UPDATE SET attempts = attempts + 1`,
    client,
    time,
  )
}

export function createLoginAttempts({ db, now }: LoginAttemptsOptions): LoginAttempts {
  db.script(SCHEMA)

  return {
    reserve: (client) =>
      db.transaction(() => {
        const time = now()
        db.run('DELETE FROM login_attempts WHERE window_started_at <= ?', time - LOGIN_WINDOW_MS)

        if (
          attemptsUsed(db, client) >= MAX_LOGIN_ATTEMPTS ||
          attemptsUsed(db, ALL_CLIENTS) >= MAX_LOGIN_ATTEMPTS_ALL_CLIENTS
        ) {
          return false
        }
        countAttempt(db, client, time)
        countAttempt(db, ALL_CLIENTS, time)
        return true
      }),
    clear: (client) => {
      db.run('DELETE FROM login_attempts WHERE client = ?', client)
    },
  }
}

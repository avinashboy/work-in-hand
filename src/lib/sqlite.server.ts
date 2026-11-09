import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const IN_MEMORY_PATH = ':memory:'
const BUSY_TIMEOUT_MS = 5000
const OWNER_ONLY_DIRECTORY = 0o700
const OWNER_ONLY_FILE = 0o600

export function getDatabasePath(): string {
  return process.env.BOARD_DB_PATH ?? resolve(process.cwd(), 'data', 'board.db')
}

export function openDatabase(path: string): DatabaseSync {
  if (path === IN_MEMORY_PATH) {
    return new DatabaseSync(path, { timeout: BUSY_TIMEOUT_MS })
  }
  mkdirSync(dirname(path), { recursive: true, mode: OWNER_ONLY_DIRECTORY })
  const db = new DatabaseSync(path, { timeout: BUSY_TIMEOUT_MS })
  // Other accounts on a shared server must not be able to read the file.
  chmodSync(path, OWNER_ONLY_FILE)
  return db
}

export function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    // A failed COMMIT may already have ended the transaction, and a second
    // error from ROLLBACK would hide the real one.
    if (db.isTransaction) db.exec('ROLLBACK')
    throw error
  }
}

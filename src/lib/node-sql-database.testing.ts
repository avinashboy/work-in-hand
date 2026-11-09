import { DatabaseSync } from 'node:sqlite'
import type { SqlDatabase, SqlValue } from './sql-database'

// Durable Objects refuse these, so the tests must fail if code relies on them.
const NOT_ALLOWED_IN_DURABLE_OBJECTS = /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|PRAGMA)\b/i

function assertAllowed(sql: string): void {
  if (NOT_ALLOWED_IN_DURABLE_OBJECTS.test(sql)) {
    throw new Error(`Durable Objects do not allow: ${sql}`)
  }
}

export interface TestDatabase extends SqlDatabase {
  readonly close: () => void
}

/** Runs the same SQL as production, on Node's SQLite instead of Cloudflare's. */
export function openTestDatabase(path = ':memory:'): TestDatabase {
  const db = new DatabaseSync(path)

  return {
    query: (sql, ...params: readonly SqlValue[]) => {
      assertAllowed(sql)
      return db.prepare(sql).all(...params)
    },
    run: (sql, ...params: readonly SqlValue[]) => {
      assertAllowed(sql)
      return Number(db.prepare(sql).run(...params).changes)
    },
    script: (sql) => {
      assertAllowed(sql)
      db.exec(sql)
    },
    transaction: (work) => {
      db.exec('BEGIN IMMEDIATE')
      try {
        const result = work()
        db.exec('COMMIT')
        return result
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK')
        throw error
      }
    },
    close: () => db.close(),
  }
}

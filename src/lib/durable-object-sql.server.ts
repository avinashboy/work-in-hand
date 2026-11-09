import type { SqlDatabase, SqlRow, SqlValue } from './sql-database'

/** The parts of a Durable Object's storage that this adapter uses. */
export interface DurableObjectSqlStorage {
  readonly sql: {
    readonly exec: (
      query: string,
      ...bindings: SqlValue[]
    ) => { toArray: () => SqlRow[]; readonly rowsWritten: number }
  }
  readonly transactionSync: <T>(work: () => T) => T
}

export function createDurableObjectSql(storage: DurableObjectSqlStorage): SqlDatabase {
  return {
    query: (sql, ...params) => storage.sql.exec(sql, ...params).toArray(),
    run: (sql, ...params) => {
      const cursor = storage.sql.exec(sql, ...params)
      // rowsWritten is only complete once the statement has run to the end.
      cursor.toArray()
      return cursor.rowsWritten
    },
    script: (sql) => {
      storage.sql.exec(sql).toArray()
    },
    transaction: (work) => storage.transactionSync(work),
  }
}

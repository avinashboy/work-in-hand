export type SqlValue = string | number | null
export type SqlRow = Readonly<Record<string, unknown>>

/** The little the board needs from SQLite, so its queries can be tested in Node. */
export interface SqlDatabase {
  readonly query: (sql: string, ...params: readonly SqlValue[]) => readonly SqlRow[]
  /** Returns 0 only if nothing changed. A higher number may include index writes. */
  readonly run: (sql: string, ...params: readonly SqlValue[]) => number
  /** Runs several statements. Takes no parameters, so never pass it user input. */
  readonly script: (sql: string) => void
  readonly transaction: <T>(work: () => T) => T
}

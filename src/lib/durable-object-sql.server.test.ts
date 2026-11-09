// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  createDurableObjectSql,
  type DurableObjectSqlStorage,
} from './durable-object-sql.server'

function fakeStorage(rows: readonly object[] = [], rowsWritten = 0) {
  const exec = vi.fn(() => ({ toArray: () => [...rows], rowsWritten }))
  const transactionSync = vi.fn(<T>(work: () => T): T => work())
  const storage = { sql: { exec }, transactionSync } as DurableObjectSqlStorage
  return { storage, exec, transactionSync }
}

describe('createDurableObjectSql', () => {
  it('passes parameters separately from the SQL and returns the rows', () => {
    const { storage, exec } = fakeStorage([{ id: 't1' }])

    const rows = createDurableObjectSql(storage).query(
      'SELECT id FROM tasks WHERE id = ?',
      "x' OR 1=1",
    )

    expect(exec).toHaveBeenCalledWith('SELECT id FROM tasks WHERE id = ?', "x' OR 1=1")
    expect(rows).toEqual([{ id: 't1' }])
  })

  it('reports how many rows a write changed', () => {
    const { storage } = fakeStorage([], 2)

    expect(createDurableObjectSql(storage).run('DELETE FROM tasks')).toBe(2)
  })

  it('runs several statements as a script', () => {
    const { storage, exec } = fakeStorage()

    createDurableObjectSql(storage).script('CREATE TABLE a (b); CREATE TABLE c (d);')

    expect(exec).toHaveBeenCalledWith('CREATE TABLE a (b); CREATE TABLE c (d);')
  })

  it('wraps work in the storage transaction and returns its result', () => {
    const { storage, transactionSync } = fakeStorage()

    const result = createDurableObjectSql(storage).transaction(() => 'done')

    expect(result).toBe('done')
    expect(transactionSync).toHaveBeenCalledOnce()
  })
})

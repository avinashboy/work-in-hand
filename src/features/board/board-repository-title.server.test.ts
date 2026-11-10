// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { COLUMN_IDS, COLUMN_TITLES, type Board } from './board-model'
import { createBoardRepository } from './board-repository.server'

const START = Date.UTC(2026, 0, 1)

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], tasks: [] })),
}

describe('card titles in the database', () => {
  let db: TestDatabase
  let repository: ReturnType<typeof createBoardRepository>

  function open() {
    return createBoardRepository({ db, now: () => START, seedBoard: emptyBoard })
  }

  function addCard(taskId: string) {
    repository.apply({
      type: 'create',
      taskId,
      columnId: 'backlog',
      title: `Card ${taskId}`,
      at: 1,
    })
  }

  function backlog(board: Board) {
    return board.columns[0].tasks
  }

  function rename(taskId: string, title: string) {
    return repository.apply({ type: 'set-title', taskId, title })
  }

  beforeEach(() => {
    db = openTestDatabase()
    repository = open()
    addCard('t1')
    addCard('t2')
  })

  afterEach(() => db.close())

  it('keeps a new title after the database wakes up again', () => {
    rename('t1', 'Renamed')

    expect(backlog(open().get()).map(({ title }) => title)).toEqual(['Renamed', 'Card t2'])
  })

  it('leaves the card where it is', () => {
    expect(backlog(rename('t2', 'Renamed')).map(({ id }) => id)).toEqual(['t1', 't2'])
  })

  it('adds an edit to the card’s timeline, not a move', () => {
    rename('t1', 'Renamed')

    expect(db.query("SELECT 1 FROM task_moves WHERE task_id = 't1'")).toHaveLength(1)
    expect(db.query("SELECT 1 FROM task_edits WHERE task_id = 't1'")).toHaveLength(1)
  })

  it('takes the new title into the history', () => {
    rename('t1', 'Renamed')
    repository.apply({ type: 'move', taskId: 't1', toColumnId: 'done', toIndex: 0, at: 1 })
    repository.apply({ type: 'archive', taskId: 't1' })

    expect(repository.listArchive(1).tasks[0].title).toBe('Renamed')
  })

  it('cannot rename a finished card', () => {
    repository.apply({ type: 'move', taskId: 't1', toColumnId: 'done', toIndex: 0, at: 1 })
    repository.apply({ type: 'archive', taskId: 't1' })

    rename('t1', 'Too late')

    expect(repository.listArchive(1).tasks[0].title).toBe('Card t1')
  })

  it('does not let a repeated create overwrite a title', () => {
    rename('t1', 'Renamed')

    const board = repository.apply({
      type: 'create',
      taskId: 't1',
      columnId: 'backlog',
      title: 'Replayed',
      at: 1,
    })

    expect(backlog(board)[0].title).toBe('Renamed')
  })
})

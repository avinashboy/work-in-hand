// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { COLUMN_IDS, COLUMN_TITLES, type Board, type ColumnId } from './board-model'
import { createBoardRepository } from './board-repository.server'

const START = Date.UTC(2026, 0, 1)

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], tasks: [] })),
}

describe('title and notes edits in the database', () => {
  let db: TestDatabase
  let clock: number
  let repository: ReturnType<typeof createBoardRepository>

  function moveTo(taskId: string, toColumnId: ColumnId) {
    repository.apply({ type: 'move', taskId, toColumnId, toIndex: 0, at: 1 })
  }

  function rename(taskId: string, title: string) {
    repository.apply({ type: 'set-title', taskId, title })
  }

  function setNotes(taskId: string, notes: string) {
    repository.apply({ type: 'set-notes', taskId, notes })
  }

  function archive(taskId: string) {
    moveTo(taskId, 'done')
    repository.apply({ type: 'archive', taskId })
    return repository.listArchive(1).tasks.find(({ id }) => id === taskId)
  }

  function editCount() {
    return db.query('SELECT 1 FROM task_edits').length
  }

  beforeEach(() => {
    db = openTestDatabase()
    clock = START
    repository = createBoardRepository({ db, now: () => clock, seedBoard: emptyBoard })
    repository.apply({ type: 'create', taskId: 't1', columnId: 'backlog', title: 'Card', at: 1 })
  })

  afterEach(() => db.close())

  it('records a title change with the column and the server’s time', () => {
    moveTo('t1', 'review')
    clock = START + 5000

    rename('t1', 'Renamed')

    expect(archive('t1')?.edits).toEqual([{ kind: 'title', columnId: 'review', at: START + 5000 }])
  })

  it('tells added, changed and removed notes apart', () => {
    setNotes('t1', 'First')
    setNotes('t1', 'Second')
    setNotes('t1', '')

    expect(archive('t1')?.edits.map(({ kind }) => kind)).toEqual([
      'notes-added',
      'notes-changed',
      'notes-removed',
    ])
  })

  it('records nothing when a card is created, even with notes', () => {
    repository.apply({
      type: 'create',
      taskId: 't2',
      columnId: 'doing',
      title: 'With notes',
      notes: 'Some notes',
      at: 1,
    })

    expect(editCount()).toBe(0)
  })

  it('records nothing for a save that changes nothing or only moves the card', () => {
    rename('t1', 'Card')
    setNotes('t1', '')
    moveTo('t1', 'doing')

    expect(editCount()).toBe(0)
  })

  it('records nothing for an edit to a finished card', () => {
    archive('t1')

    rename('t1', 'Too late')

    expect(editCount()).toBe(0)
  })

  it('shows the edits through the API’s card lookup', () => {
    setNotes('t1', 'Details')

    expect(repository.findTask('t1')?.edits).toEqual([
      { kind: 'notes-added', columnId: 'backlog', at: START },
    ])
  })

  it('forgets the edits of a deleted card', () => {
    rename('t1', 'Renamed')

    repository.apply({ type: 'delete', taskId: 't1' })

    expect(editCount()).toBe(0)
  })

  it('forgets the edits of a card deleted from the history', () => {
    rename('t1', 'Renamed')
    archive('t1')

    repository.deleteArchived('t1')

    expect(editCount()).toBe(0)
  })
})

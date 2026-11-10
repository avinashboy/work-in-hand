// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { ARCHIVE_AFTER_MS, COLUMN_IDS, COLUMN_TITLES, type Board } from './board-model'
import { createBoardRepository } from './board-repository.server'

const START = Date.UTC(2026, 0, 1)

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], tasks: [] })),
}

describe('who moved a card to History', () => {
  let db: TestDatabase
  let clock: number
  let repository: ReturnType<typeof createBoardRepository>

  function archivedCard(taskId: string) {
    return repository.listArchive(1).tasks.find(({ id }) => id === taskId)
  }

  function actorRows() {
    return db.query('SELECT task_id FROM task_archive_actors')
  }

  beforeEach(() => {
    db = openTestDatabase()
    clock = START
    repository = createBoardRepository({ db, now: () => clock, seedBoard: emptyBoard })
    repository.apply({ type: 'create', taskId: 't1', columnId: 'backlog', title: 'Card', at: 1 })
    repository.apply({ type: 'move', taskId: 't1', toColumnId: 'done', toIndex: 0, at: 1 })
  })

  afterEach(() => db.close())

  it('records the board when the Archive button is pressed', () => {
    repository.apply({ type: 'archive', taskId: 't1' })

    expect(archivedCard('t1')).toEqual(
      expect.objectContaining({ reason: 'confirmed', archivedBy: { kind: 'board', client: null } }),
    )
  })

  it('records the agent and its name when an agent archives a card', () => {
    repository.archiveTask('t1', { kind: 'agent', client: 'Claude Desktop' })

    expect(archivedCard('t1')?.archivedBy).toEqual({ kind: 'agent', client: 'Claude Desktop' })
    expect(repository.findTask('t1')?.archivedBy).toEqual({ kind: 'agent', client: 'Claude Desktop' })
  })

  it('records the API when an app archives a card without naming itself', () => {
    repository.archiveTask('t1', { kind: 'api', client: null })

    expect(archivedCard('t1')?.archivedBy).toEqual({ kind: 'api', client: null })
  })

  it('records no one when a card moves to History by itself after 24 hours', () => {
    clock = START + ARCHIVE_AFTER_MS + 1

    expect(archivedCard('t1')).toEqual(expect.objectContaining({ reason: 'expired', archivedBy: null }))
  })

  it('reports no one on a card still on the board', () => {
    expect(repository.findTask('t1')?.archivedBy).toBeNull()
  })

  it('records nothing when archiving is refused', () => {
    repository.apply({ type: 'create', taskId: 't2', columnId: 'backlog', title: 'Not done', at: 1 })

    expect(repository.archiveTask('t2', { kind: 'agent', client: 'Cursor' })).toEqual({ outcome: 'not-done' })
    expect(actorRows()).toEqual([])
  })

  it('forgets who archived a card once it is deleted from History', () => {
    repository.archiveTask('t1', { kind: 'agent', client: 'Cursor' })
    repository.deleteArchived('t1')

    expect(actorRows()).toEqual([])
  })

  it('forgets it too when an agent deletes the card', () => {
    repository.archiveTask('t1', { kind: 'agent', client: 'Cursor' })
    repository.removeTask('t1')

    expect(actorRows()).toEqual([])
  })
})

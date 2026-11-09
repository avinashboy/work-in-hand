// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import {
  ARCHIVE_AFTER_MS,
  COLUMN_IDS,
  COLUMN_TITLES,
  type Board,
  type ColumnId,
} from './board-model'
import { createBoardRepository } from './board-repository.server'
import type { TaskChange, TaskQuery } from './board-task-queries.server'

const START = Date.UTC(2026, 0, 1)
const HOUR = 60 * 60 * 1000

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], tasks: [] })),
}

const allTasks: TaskQuery = {
  status: 'all',
  columns: [],
  archived: null,
  search: null,
  createdAfter: null,
  createdBefore: null,
  doneAfter: null,
  doneBefore: null,
  sort: 'createdAt',
  order: 'desc',
  page: 1,
  limit: 50,
}

function changedTask(change: TaskChange) {
  if (change.outcome !== 'changed') throw new Error(`Expected a change, got ${change.outcome}`)
  return change.task
}

describe('board repository for the API', () => {
  let db: TestDatabase
  let time: number
  let repository: ReturnType<typeof createBoardRepository>

  function add(taskId: string, columnId: ColumnId = 'backlog', notes = '') {
    time += HOUR
    repository.apply({ type: 'create', taskId, columnId, title: `Card ${taskId}`, notes, at: 1 })
  }

  function moveToDone(taskId: string) {
    time += HOUR
    repository.apply({ type: 'move', taskId, toColumnId: 'done', toIndex: 0, at: 1 })
  }

  function archive(taskId: string) {
    moveToDone(taskId)
    repository.apply({ type: 'archive', taskId })
  }

  const list = (query: Partial<TaskQuery> = {}) => repository.listTasks({ ...allTasks, ...query })
  const ids = (query: Partial<TaskQuery> = {}) => list(query).tasks.map(({ id }) => id)

  beforeEach(() => {
    db = openTestDatabase()
    time = START
    repository = createBoardRepository({ db, now: () => time, seedBoard: emptyBoard })
  })

  afterEach(() => db.close())

  describe('listTasks', () => {
    beforeEach(() => {
      add('todo', 'backlog', 'Ring the Bank')
      add('working', 'doing')
      add('finished')
      moveToDone('finished')
      add('filed')
      archive('filed')
    })

    it('returns everything, newest first, by default', () => {
      expect(ids()).toEqual(['filed', 'finished', 'working', 'todo'])
    })

    it('returns only ongoing cards', () => {
      expect(ids({ status: 'ongoing' })).toEqual(['working', 'todo'])
    })

    it('counts the Done column and the history as completed', () => {
      expect(ids({ status: 'completed' })).toEqual(['filed', 'finished'])
    })

    it('filters by one or several columns', () => {
      expect(ids({ columns: ['doing'] })).toEqual(['working'])
      expect(ids({ columns: ['backlog', 'doing'] })).toEqual(['working', 'todo'])
    })

    it('separates the history from the board', () => {
      expect(ids({ archived: true })).toEqual(['filed'])
      expect(ids({ archived: false })).toEqual(['finished', 'working', 'todo'])
    })

    it('searches titles and notes, ignoring case', () => {
      expect(ids({ search: 'WORKING' })).toEqual(['working'])
      expect(ids({ search: 'the bank' })).toEqual(['todo'])
    })

    it('treats search text literally', () => {
      expect(ids({ search: '%' })).toEqual([])
      expect(ids({ search: "'; DROP TABLE tasks; --" })).toEqual([])
      expect(ids()).toHaveLength(4)
    })

    it('filters by when cards were created', () => {
      expect(ids({ createdAfter: START + 2 * HOUR, createdBefore: START + 3 * HOUR })).toEqual([
        'working',
      ])
    })

    it('filters by when cards were done', () => {
      const [finished] = list({ columns: ['done'], archived: false }).tasks

      expect(ids({ doneAfter: finished.doneAt ?? 0, doneBefore: (finished.doneAt ?? 0) + 1 })).toEqual([
        'finished',
      ])
    })

    it('sorts by a chosen field and direction', () => {
      expect(ids({ sort: 'title', order: 'asc' })).toEqual(['filed', 'finished', 'todo', 'working'])
      expect(ids({ sort: 'createdAt', order: 'asc' })).toEqual([
        'todo',
        'working',
        'finished',
        'filed',
      ])
    })

    it('pages through results and reports the totals', () => {
      const page = list({ limit: 3, page: 2 })

      expect(page.tasks.map(({ id }) => id)).toEqual(['todo'])
      expect(page).toMatchObject({ total: 4, page: 2, limit: 3, pageCount: 2 })
    })

    it('returns an empty page past the end', () => {
      expect(list({ page: 9 })).toMatchObject({ tasks: [], total: 4, page: 9 })
    })

    it('files expired cards before reading', () => {
      time += ARCHIVE_AFTER_MS + HOUR

      expect(ids({ archived: true })).toEqual(['filed', 'finished'])
    })

    it('includes each card’s column, notes and history state', () => {
      expect(list({ columns: ['backlog'] }).tasks[0]).toMatchObject({
        columnId: 'backlog',
        notes: 'Ring the Bank',
        archivedAt: null,
        archiveReason: null,
      })
      expect(list({ archived: true }).tasks[0]).toMatchObject({
        columnId: 'done',
        archiveReason: 'confirmed',
      })
    })
  })

  describe('findTask', () => {
    it('returns a board card with its timeline', () => {
      add('t1', 'doing', 'Details')

      expect(repository.findTask('t1')).toMatchObject({
        id: 't1',
        columnId: 'doing',
        notes: 'Details',
        moves: [{ columnId: 'doing', at: START + HOUR }],
      })
    })

    it('finds a card in the history', () => {
      add('t1')
      archive('t1')

      expect(repository.findTask('t1')?.archiveReason).toBe('confirmed')
    })

    it('returns null for an unknown card', () => {
      expect(repository.findTask('nope')).toBeNull()
    })
  })

  describe('summarizeTasks', () => {
    it('counts cards per column and overall', () => {
      add('a')
      add('b', 'doing')
      add('c')
      moveToDone('c')
      add('d')
      archive('d')

      expect(repository.summarizeTasks()).toEqual({
        columns: [
          { id: 'backlog', title: 'Backlog', count: 1 },
          { id: 'doing', title: 'In progress', count: 1 },
          { id: 'review', title: 'In review', count: 0 },
          { id: 'done', title: 'Done', count: 1 },
        ],
        ongoing: 2,
        completed: 2,
        archived: 1,
        total: 4,
      })
    })
  })

  describe('updateTask', () => {
    beforeEach(() => {
      add('a')
      add('b')
    })

    it('changes the title and notes together', () => {
      const task = changedTask(repository.updateTask('a', { title: 'New', notes: 'More' }))

      expect(task).toMatchObject({ title: 'New', notes: 'More', columnId: 'backlog' })
      expect(repository.findTask('a')).toMatchObject({ title: 'New', notes: 'More' })
    })

    it('clears notes', () => {
      repository.updateTask('a', { notes: 'Temporary' })

      expect(changedTask(repository.updateTask('a', { notes: '' })).notes).toBe('')
    })

    it('moves a card to the end of another column and logs it', () => {
      add('c', 'review')

      const task = changedTask(repository.updateTask('a', { columnId: 'review' }))

      expect(task.columnId).toBe('review')
      expect(task.moves.map(({ columnId }) => columnId)).toEqual(['backlog', 'review'])
      expect(ids2('review')).toEqual(['c', 'a'])
    })

    it('marks a card done and un-done', () => {
      expect(changedTask(repository.updateTask('a', { columnId: 'done' })).doneAt).toBe(time)
      expect(changedTask(repository.updateTask('a', { columnId: 'doing' })).doneAt).toBeNull()
    })

    it('reorders within a column without logging a move', () => {
      const task = changedTask(repository.updateTask('b', { position: 0 }))

      expect(ids2('backlog')).toEqual(['b', 'a'])
      expect(task.moves).toHaveLength(1)
    })

    it('leaves the order alone when the column is unchanged', () => {
      repository.updateTask('a', { columnId: 'backlog' })

      expect(ids2('backlog')).toEqual(['a', 'b'])
    })

    it('reports an unknown card', () => {
      expect(repository.updateTask('nope', { title: 'x' })).toEqual({ outcome: 'missing' })
    })

    it('refuses to change a card in the history', () => {
      archive('a')

      expect(repository.updateTask('a', { title: 'Too late' })).toEqual({ outcome: 'history' })
      expect(repository.findTask('a')?.title).toBe('Card a')
    })

    function ids2(columnId: ColumnId) {
      return (
        repository
          .get()
          .columns.find(({ id }) => id === columnId)
          ?.tasks.map(({ id }) => id) ?? []
      )
    }
  })

  describe('removeTask', () => {
    it('deletes a board card with its notes and timeline', () => {
      add('a', 'backlog', 'Goes too')

      expect(repository.removeTask('a')).toBe(true)
      expect(repository.findTask('a')).toBeNull()
      expect(db.query('SELECT 1 FROM task_notes')).toEqual([])
      expect(db.query('SELECT 1 FROM task_moves')).toEqual([])
    })

    it('deletes a card from the history', () => {
      add('a')
      archive('a')

      expect(repository.removeTask('a')).toBe(true)
      expect(repository.findTask('a')).toBeNull()
    })

    it('reports an unknown card', () => {
      expect(repository.removeTask('nope')).toBe(false)
    })
  })

  describe('archiveTask', () => {
    it('files a card that is done', () => {
      add('a')
      moveToDone('a')

      const task = changedTask(repository.archiveTask('a'))

      expect(task).toMatchObject({ archivedAt: time, archiveReason: 'confirmed' })
    })

    it('refuses a card that is not done', () => {
      add('a')

      expect(repository.archiveTask('a')).toEqual({ outcome: 'not-done' })
    })

    it('reports an unknown card', () => {
      expect(repository.archiveTask('nope')).toEqual({ outcome: 'missing' })
    })

    it('reports a card already in the history', () => {
      add('a')
      archive('a')

      expect(repository.archiveTask('a')).toEqual({ outcome: 'history' })
    })
  })
})

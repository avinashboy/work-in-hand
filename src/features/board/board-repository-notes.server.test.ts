// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import {
  COLUMN_IDS,
  COLUMN_TITLES,
  MAX_TASKS_ON_BOARD,
  type Board,
} from './board-model'
import { createBoardRepository } from './board-repository.server'

const START = Date.UTC(2026, 0, 1)

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({ id, title: COLUMN_TITLES[id], tasks: [] })),
}

describe('card notes in the database', () => {
  let db: TestDatabase
  let repository: ReturnType<typeof createBoardRepository>

  function open() {
    return createBoardRepository({ db, now: () => START, seedBoard: emptyBoard })
  }

  function addCard(taskId = 't1') {
    return repository.apply({
      type: 'create',
      taskId,
      columnId: 'backlog',
      title: `Card ${taskId}`,
      at: 1,
    })
  }

  function setNotes(notes: string, taskId = 't1') {
    return repository.apply({ type: 'set-notes', taskId, notes })
  }

  function card(board: Board, taskId = 't1') {
    return board.columns.flatMap(({ tasks }) => tasks).find(({ id }) => id === taskId)
  }

  function storedNotes() {
    return db.query('SELECT task_id, notes FROM task_notes')
  }

  function finishAndArchive(taskId = 't1') {
    repository.apply({ type: 'move', taskId, toColumnId: 'done', toIndex: 0, at: 1 })
    repository.apply({ type: 'archive', taskId })
  }

  beforeEach(() => {
    db = openTestDatabase()
    repository = open()
  })

  afterEach(() => db.close())

  it('starts every card with empty notes', () => {
    expect(card(addCard())?.notes).toBe('')
  })

  it('saves and replaces notes', () => {
    addCard()
    setNotes('First version')

    expect(card(setNotes('Second version'))?.notes).toBe('Second version')
    expect(card(repository.get())?.notes).toBe('Second version')
  })

  it('keeps each card’s notes separate', () => {
    addCard('t1')
    addCard('t2')

    const board = setNotes('Only on t2', 't2')

    expect(card(board, 't1')?.notes).toBe('')
    expect(card(board, 't2')?.notes).toBe('Only on t2')
  })

  it('keeps notes when the card moves', () => {
    addCard()
    setNotes('Stays with the card')

    const board = repository.apply({
      type: 'move',
      taskId: 't1',
      toColumnId: 'doing',
      toIndex: 0,
      at: 1,
    })

    expect(card(board)?.notes).toBe('Stays with the card')
  })

  it('removes the stored row when notes are cleared', () => {
    addCard()
    setNotes('Temporary')

    expect(card(setNotes(''))?.notes).toBe('')
    expect(storedNotes()).toEqual([])
  })

  it('stores notes given when the card is created', () => {
    const board = repository.apply({
      type: 'create',
      taskId: 't1',
      columnId: 'review',
      title: 'Card',
      notes: 'Written up front',
      at: 1,
    })

    expect(card(board)?.notes).toBe('Written up front')
  })

  it('shows notes on a card in the history', () => {
    addCard()
    setNotes('Remember this')
    finishAndArchive()

    expect(repository.listArchive(1).tasks[0].notes).toBe('Remember this')
  })

  it('shows empty notes on a history card without any', () => {
    addCard()
    finishAndArchive()

    expect(repository.listArchive(1).tasks[0].notes).toBe('')
  })

  it('deletes notes with a card deleted from the board', () => {
    addCard()
    setNotes('Goes too')

    repository.apply({ type: 'delete', taskId: 't1' })

    expect(storedNotes()).toEqual([])
  })

  it('deletes notes with a card deleted from the history', () => {
    addCard()
    setNotes('Goes too')
    finishAndArchive()

    repository.deleteArchived('t1')

    expect(storedNotes()).toEqual([])
  })

  it('cannot change the notes of a finished card by reusing its id', () => {
    addCard()
    setNotes('Original')
    finishAndArchive()

    repository.apply({
      type: 'create',
      taskId: 't1',
      columnId: 'backlog',
      title: 'Imposter',
      notes: 'Overwritten',
      at: 1,
    })

    expect(repository.listArchive(1).tasks[0].notes).toBe('Original')
  })

  it('adds the notes table to a database made before notes existed', () => {
    addCard()
    db.script('DROP TABLE task_notes;')

    repository = open()

    expect(card(repository.get())?.notes).toBe('')
    expect(card(setNotes('Now it works'))?.notes).toBe('Now it works')
  })

  it('keeps existing notes when the database wakes up again', () => {
    addCard()
    setNotes('Still here')

    expect(card(open().get())?.notes).toBe('Still here')
  })

  describe('createTask', () => {
    const input = { columnId: 'doing', title: 'From voice', notes: 'Details' } as const

    it('creates a card and returns it', () => {
      const task = repository.createTask(input)

      expect(task).toMatchObject({ title: 'From voice', notes: 'Details', createdAt: START })
      expect(repository.get().columns[1].tasks.map(({ id }) => id)).toEqual([task?.id])
    })

    it('logs the column it landed in for the timeline', () => {
      const task = repository.createTask(input)

      expect(db.query('SELECT column_id FROM task_moves WHERE task_id = ?', task?.id ?? '')).toEqual([
        { column_id: 'doing' },
      ])
    })

    it('returns null when the board is full', () => {
      Array.from({ length: MAX_TASKS_ON_BOARD }).forEach((_, index) => addCard(`c${index}`))

      expect(repository.createTask(input)).toBeNull()
    })
  })
})

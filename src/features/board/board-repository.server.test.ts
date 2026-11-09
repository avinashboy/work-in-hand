// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { createBoardRepository } from './board-repository.server'
import { boardSnapshotSchema, type BoardSnapshot } from './board-snapshot'
import {
  ARCHIVE_AFTER_MS,
  ARCHIVE_PAGE_SIZE,
  COLUMN_IDS,
  COLUMN_TITLES,
  MAX_TASKS_ON_BOARD,
  type Board,
  type BoardCommand,
  type ColumnId,
} from './board-model'

const START = Date.UTC(2026, 0, 1)
const CLIENT_CLOCK = 123

const emptyBoard: Board = {
  columns: COLUMN_IDS.map((id) => ({
    id,
    title: COLUMN_TITLES[id],
    tasks: [],
  })),
}

const sampleTask = {
  id: 's1',
  title: 'Sample',
  notes: '',
  createdAt: START,
  movedAt: START,
  doneAt: null,
}

function create(taskId: string, columnId: ColumnId = 'backlog'): BoardCommand {
  return { type: 'create', taskId, columnId, title: `Task ${taskId}`, at: CLIENT_CLOCK }
}

function moveToDone(taskId: string): BoardCommand {
  return { type: 'move', taskId, toColumnId: 'done', toIndex: 0, at: CLIENT_CLOCK }
}

function idsIn(board: Board, columnId: ColumnId): string[] {
  const column = board.columns.find(({ id }) => id === columnId)
  return column ? column.tasks.map(({ id }) => id) : []
}

describe('createBoardRepository', () => {
  let clock: number
  let db: TestDatabase
  let repository: ReturnType<typeof createBoardRepository>

  beforeEach(() => {
    clock = START
    db = openTestDatabase()
    repository = createBoardRepository({
      db,
      now: () => clock,
      seedBoard: emptyBoard,
    })
  })

  afterEach(() => db.close())

  it('stamps a new task with the server clock, not the client one', () => {
    const board = repository.apply(create('t1'))

    expect(board.columns[0].tasks[0]).toMatchObject({
      id: 't1',
      createdAt: START,
      doneAt: null,
    })
  })

  it('records the server time a task reached Done', () => {
    repository.apply(create('t1'))
    clock += 5000

    const board = repository.apply(moveToDone('t1'))

    expect(board.columns[3].tasks[0].doneAt).toBe(START + 5000)
  })

  it('keeps task order within a column', () => {
    repository.apply(create('t1'))
    repository.apply(create('t2'))

    const board = repository.apply({
      type: 'move',
      taskId: 't2',
      toColumnId: 'backlog',
      toIndex: 0,
      at: CLIENT_CLOCK,
    })

    expect(idsIn(board, 'backlog')).toEqual(['t2', 't1'])
  })

  it('rejects new tasks once the board is full', () => {
    for (let index = 0; index < MAX_TASKS_ON_BOARD; index += 1) {
      repository.apply(create(`t${index}`))
    }

    expect(() => repository.apply(create('one-too-many'))).toThrow(
      'Board is full',
    )
    expect(idsIn(repository.get(), 'backlog')).not.toContain('one-too-many')
  })

  it('removes a deleted task without archiving it', () => {
    repository.apply(create('t1'))

    const board = repository.apply({ type: 'delete', taskId: 't1' })

    expect(idsIn(board, 'backlog')).toEqual([])
    expect(repository.listArchive(1).total).toBe(0)
  })

  describe('deleting from the history', () => {
    function fileCard(taskId: string) {
      repository.apply(create(taskId))
      repository.apply(moveToDone(taskId))
      repository.apply({ type: 'archive', taskId })
    }

    it('removes the card from the history', () => {
      fileCard('t1')
      fileCard('t2')

      repository.deleteArchived('t1')

      const history = repository.listArchive(1)
      expect(history.total).toBe(1)
      expect(history.tasks.map(({ id }) => id)).toEqual(['t2'])
    })

    it('removes the record of its moves too', () => {
      fileCard('t1')
      repository.deleteArchived('t1')
      clock += 1000

      fileCard('t1')

      expect(repository.listArchive(1).tasks[0].moves).toEqual([
        { columnId: 'backlog', at: START + 1000 },
        { columnId: 'done', at: START + 1000 },
      ])
    })

    it('refuses a card still on the board', () => {
      repository.apply(create('t1'))

      repository.deleteArchived('t1')

      expect(idsIn(repository.get(), 'backlog')).toEqual(['t1'])
    })

    it('keeps the move record of a card it refused', () => {
      repository.apply(create('t1'))
      repository.deleteArchived('t1')

      repository.apply(moveToDone('t1'))
      repository.apply({ type: 'archive', taskId: 't1' })

      expect(repository.listArchive(1).tasks[0].moves).toHaveLength(2)
    })

    it('does nothing for a card that does not exist', () => {
      fileCard('t1')

      repository.deleteArchived('missing')

      expect(repository.listArchive(1).total).toBe(1)
    })

    it('can be repeated safely', () => {
      fileCard('t1')

      repository.deleteArchived('t1')
      repository.deleteArchived('t1')

      expect(repository.listArchive(1).total).toBe(0)
    })
  })

  describe('Archive button', () => {
    it('moves a done task into the history', () => {
      repository.apply(create('t1'))
      repository.apply(moveToDone('t1'))
      clock += 1000

      const board = repository.apply({ type: 'archive', taskId: 't1' })

      expect(idsIn(board, 'done')).toEqual([])
      expect(repository.listArchive(1).tasks[0]).toMatchObject({
        id: 't1',
        createdAt: START,
        doneAt: START,
        archivedAt: START + 1000,
        reason: 'confirmed',
      })
    })

    it('refuses a task that is not done', () => {
      repository.apply(create('t1'))

      const board = repository.apply({ type: 'archive', taskId: 't1' })

      expect(idsIn(board, 'backlog')).toEqual(['t1'])
      expect(repository.listArchive(1).total).toBe(0)
    })

    it('cannot overwrite an archived task by re-creating its id', () => {
      repository.apply(create('t1'))
      repository.apply(moveToDone('t1'))
      repository.apply({ type: 'archive', taskId: 't1' })

      const board = repository.apply(create('t1'))

      expect(idsIn(board, 'backlog')).toEqual([])
      expect(repository.listArchive(1).tasks[0].reason).toBe('confirmed')
    })
  })

  describe('24-hour archive', () => {
    beforeEach(() => {
      repository.apply(create('t1'))
      repository.apply(moveToDone('t1'))
    })

    it('leaves a task in Done just before 24 hours', () => {
      clock += ARCHIVE_AFTER_MS - 1

      expect(idsIn(repository.get(), 'done')).toEqual(['t1'])
    })

    it('archives a task at 24 hours, dated when it became due', () => {
      clock += ARCHIVE_AFTER_MS + 60_000

      expect(idsIn(repository.get(), 'done')).toEqual([])
      expect(repository.listArchive(1).tasks[0]).toMatchObject({
        id: 't1',
        archivedAt: START + ARCHIVE_AFTER_MS,
        reason: 'expired',
      })
    })

    it('is applied when only the history is read', () => {
      clock += ARCHIVE_AFTER_MS

      expect(repository.listArchive(1).total).toBe(1)
    })

    it('restarts the 24 hours if a task leaves Done and returns', () => {
      clock += ARCHIVE_AFTER_MS - 1
      repository.apply({
        type: 'move',
        taskId: 't1',
        toColumnId: 'doing',
        toIndex: 0,
        at: CLIENT_CLOCK,
      })
      repository.apply(moveToDone('t1'))
      clock += ARCHIVE_AFTER_MS - 1

      expect(idsIn(repository.get(), 'done')).toEqual(['t1'])
    })
  })

  describe('move history', () => {
    const move = (taskId: string, toColumnId: ColumnId): BoardCommand => ({
      type: 'move',
      taskId,
      toColumnId,
      toIndex: 0,
      at: CLIENT_CLOCK,
    })

    function file(taskId: string) {
      repository.apply(moveToDone(taskId))
      repository.apply({ type: 'archive', taskId })
      return repository.listArchive(1).tasks[0].moves
    }

    it('records every column a card lands in, by the server clock', () => {
      repository.apply(create('t1'))
      clock += 1000
      repository.apply(move('t1', 'doing'))
      clock += 1000
      repository.apply(move('t1', 'review'))
      clock += 1000

      expect(file('t1')).toEqual([
        { columnId: 'backlog', at: START },
        { columnId: 'doing', at: START + 1000 },
        { columnId: 'review', at: START + 2000 },
        { columnId: 'done', at: START + 3000 },
      ])
    })

    it('tells the board when a card landed', () => {
      repository.apply(create('t1'))
      clock += 1000

      const board = repository.apply(move('t1', 'review'))

      expect(board.columns[2].tasks[0].movedAt).toBe(START + 1000)
    })

    it('does not record reordering inside a column', () => {
      repository.apply(create('t1'))
      repository.apply(create('t2'))
      clock += 1000

      const board = repository.apply(move('t2', 'backlog'))

      expect(board.columns[0].tasks[0]).toMatchObject({ id: 't2', movedAt: START })
      expect(file('t2')).toHaveLength(2)
    })

    it('records a repeated move only once', () => {
      repository.apply(create('t1'))
      clock += 1000
      repository.apply(move('t1', 'doing'))
      clock += 1000
      repository.apply(move('t1', 'doing'))

      expect(file('t1').filter(({ columnId }) => columnId === 'doing')).toEqual([
        { columnId: 'doing', at: START + 1000 },
      ])
    })

    it('keeps every trip when a card goes back and forth', () => {
      repository.apply(create('t1'))
      repository.apply(move('t1', 'review'))
      repository.apply(move('t1', 'doing'))
      repository.apply(move('t1', 'review'))

      expect(file('t1').map(({ columnId }) => columnId)).toEqual([
        'backlog',
        'review',
        'doing',
        'review',
        'done',
      ])
    })

    it('adds nothing when an archived id is re-created', () => {
      repository.apply(create('t1'))
      const before = file('t1')

      repository.apply(create('t1', 'doing'))

      expect(repository.listArchive(1).tasks[0].moves).toEqual(before)
    })

    it('forgets the moves of a deleted card', () => {
      repository.apply(create('t1'))
      repository.apply(move('t1', 'review'))
      repository.apply({ type: 'delete', taskId: 't1' })
      clock += 1000
      repository.apply(create('t1'))

      expect(file('t1')).toEqual([
        { columnId: 'backlog', at: START + 1000 },
        { columnId: 'done', at: START + 1000 },
      ])
    })
  })

  it('pages the history, newest first', () => {
    const count = ARCHIVE_PAGE_SIZE + 1
    for (let index = 0; index < count; index += 1) {
      repository.apply(create(`t${index}`, 'done'))
      clock += 1000
      repository.apply({ type: 'archive', taskId: `t${index}` })
    }

    const first = repository.listArchive(1)
    const second = repository.listArchive(2)

    expect(first.tasks).toHaveLength(ARCHIVE_PAGE_SIZE)
    expect(first.tasks[0].id).toBe(`t${count - 1}`)
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: count })
    expect(second.tasks.map(({ id }) => id)).toEqual(['t0'])
  })

  it('shows the last page when asked for a page past the end', () => {
    repository.apply(create('t1', 'done'))
    repository.apply({ type: 'archive', taskId: 't1' })

    const page = repository.listArchive(99)

    expect(page).toMatchObject({ page: 1, pageCount: 1, total: 1 })
    expect(page.tasks.map(({ id }) => id)).toEqual(['t1'])
  })
})

describe('starting from an exported board', () => {
  const snapshot: BoardSnapshot = {
    tasks: [
      {
        id: 'second',
        title: 'Second',
        columnId: 'doing',
        position: 1,
        createdAt: START - 9000,
        movedAt: START - 8000,
        doneAt: null,
        archivedAt: null,
        archiveReason: null,
      },
      {
        id: 'first',
        title: 'First',
        columnId: 'doing',
        position: 0,
        createdAt: START - 9000,
        movedAt: START - 9000,
        doneAt: null,
        archivedAt: null,
        archiveReason: null,
      },
      {
        id: 'filed',
        title: 'Filed',
        columnId: 'done',
        position: 0,
        createdAt: START - 9000,
        movedAt: START - 5000,
        doneAt: START - 5000,
        archivedAt: START - 1000,
        archiveReason: 'confirmed',
      },
    ],
    moves: [
      { taskId: 'filed', columnId: 'backlog', at: START - 9000 },
      { taskId: 'filed', columnId: 'done', at: START - 5000 },
    ],
  }

  let db: TestDatabase

  beforeEach(() => {
    db = openTestDatabase()
  })

  afterEach(() => db.close())

  function open() {
    return createBoardRepository({
      db,
      now: () => START,
      seedBoard: emptyBoard,
      loadSnapshot: () => snapshot,
    })
  }

  it('keeps cards on the board, in order, with their times', () => {
    const board = open().get()

    expect(idsIn(board, 'doing')).toEqual(['first', 'second'])
    expect(board.columns[1].tasks[1]).toMatchObject({
      createdAt: START - 9000,
      movedAt: START - 8000,
    })
  })

  it('keeps the history and each timeline', () => {
    expect(open().listArchive(1).tasks[0]).toMatchObject({
      id: 'filed',
      archivedAt: START - 1000,
      reason: 'confirmed',
      moves: [
        { columnId: 'backlog', at: START - 9000 },
        { columnId: 'done', at: START - 5000 },
      ],
    })
  })

  it('is only ever imported once', () => {
    open().deleteArchived('filed')

    expect(open().listArchive(1).total).toBe(0)
  })

  it('is not even read once the board exists', () => {
    open()

    expect(() =>
      createBoardRepository({
        db,
        now: () => START,
        seedBoard: emptyBoard,
        loadSnapshot: () => {
          throw new Error('damaged export file')
        },
      }),
    ).not.toThrow()
  })

  it('is used instead of the sample cards', () => {
    const seeded = {
      columns: emptyBoard.columns.map((column) =>
        column.id === 'backlog' ? { ...column, tasks: [sampleTask] } : column,
      ),
    }

    const board = createBoardRepository({
      db,
      now: () => START,
      seedBoard: seeded,
      loadSnapshot: () => snapshot,
    }).get()

    expect(idsIn(board, 'backlog')).toEqual([])
  })

  it('accepts a real export and refuses a damaged one', () => {
    expect(boardSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(boardSnapshotSchema.safeParse({ tasks: [{ id: 'x' }], moves: [] }).success).toBe(false)
  })
})

describe('database file', () => {
  let directory: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'board-db-'))
  })

  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  function open(seedBoard: Board = emptyBoard) {
    const db = openTestDatabase(join(directory, 'board.db'))
    return {
      ...createBoardRepository({ db, now: () => START, seedBoard }),
      close: db.close,
    }
  }

  it('keeps data after the database is reopened', () => {
    const first = open()
    first.apply(create('t1'))
    first.close()

    const second = open()

    expect(idsIn(second.get(), 'backlog')).toEqual(['t1'])
    second.close()
  })

  it('does not bring sample tasks back after they are deleted', () => {
    const seeded: Board = {
      columns: emptyBoard.columns.map((column) =>
        column.id === 'backlog'
          ? {
              ...column,
              tasks: [sampleTask],
            }
          : column,
      ),
    }
    const first = open(seeded)
    first.apply({ type: 'delete', taskId: 's1' })
    first.close()

    const second = open(seeded)

    expect(idsIn(second.get(), 'backlog')).toEqual([])
    second.close()
  })

  it('records where sample tasks start', () => {
    const seeded: Board = {
      columns: emptyBoard.columns.map((column) =>
        column.id === 'backlog' ? { ...column, tasks: [sampleTask] } : column,
      ),
    }
    const repository = open(seeded)
    repository.apply(moveToDone('s1'))
    repository.apply({ type: 'archive', taskId: 's1' })

    expect(repository.listArchive(1).tasks[0].moves[0]).toEqual({
      columnId: 'backlog',
      at: START,
    })
    repository.close()
  })
})

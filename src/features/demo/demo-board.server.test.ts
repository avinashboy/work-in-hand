import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import type { Board, BoardCommand } from '../board/board-model'
import { createDemoBoard, type DemoBoard } from './demo-board.server'
import {
  DEMO_CARD_LIFETIME_MS,
  DEMO_MAX_CARDS,
  DEMO_MAX_WRITES_PER_DAY,
} from './demo-config'

const START = Date.UTC(2026, 10, 9, 12)
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function create(taskId: string, columnId: 'backlog' | 'done' = 'backlog'): BoardCommand {
  return { type: 'create', taskId, columnId, title: `Card ${taskId}`, at: 0 }
}

function titles(board: Board): string[] {
  return board.columns.flatMap(({ tasks }) => tasks.map(({ title }) => title))
}

function rowCount(db: TestDatabase, table: string): unknown {
  return db.query(`SELECT COUNT(*) AS total FROM ${table}`)[0].total
}

describe('demo board', () => {
  let db: TestDatabase
  let time: number
  let board: DemoBoard

  beforeEach(() => {
    db = openTestDatabase()
    time = START
    board = createDemoBoard({ db, now: () => time })
  })

  afterEach(() => db.close())

  it('starts with no cards', () => {
    expect(titles(board.get())).toEqual([])
  })

  it('keeps a card until just before its lifetime ends', () => {
    board.apply(create('a'))

    time = START + DEMO_CARD_LIFETIME_MS - 1

    expect(titles(board.get())).toEqual(['Card a'])
  })

  it('removes a card from the board once its lifetime ends', () => {
    board.apply(create('a'))

    time = START + DEMO_CARD_LIFETIME_MS

    expect(titles(board.get())).toEqual([])
  })

  it('counts the lifetime from creation, so moving a card does not extend it', () => {
    board.apply(create('a'))
    time = START + DEMO_CARD_LIFETIME_MS - 1
    board.apply({ type: 'move', taskId: 'a', toColumnId: 'doing', toIndex: 0, at: 0 })

    time = START + DEMO_CARD_LIFETIME_MS

    expect(titles(board.get())).toEqual([])
  })

  it('also removes expired cards from history, with their notes and timeline', () => {
    board.apply({ ...create('a', 'done'), notes: 'Some notes' } as BoardCommand)
    board.apply({ type: 'set-notes', taskId: 'a', notes: 'Some notes' })
    board.apply({ type: 'archive', taskId: 'a', at: 0 } as BoardCommand)
    expect(board.listArchive(1).total).toBe(1)

    time = START + DEMO_CARD_LIFETIME_MS

    expect(board.listArchive(1).total).toBe(0)
    expect(rowCount(db, 'tasks')).toBe(0)
    expect(rowCount(db, 'task_notes')).toBe(0)
    expect(rowCount(db, 'task_moves')).toBe(0)
  })

  it('deletes expired cards from storage even if nobody visits', () => {
    board.apply(create('a'))
    time = START + 1000
    board.apply(create('b'))

    time = START + DEMO_CARD_LIFETIME_MS
    board.deleteExpired()

    expect(rowCount(db, 'tasks')).toBe(1)
  })

  it('reports when the next card is due to be deleted', () => {
    expect(board.nextExpiry()).toBeNull()

    board.apply(create('a'))
    time = START + 1000
    board.apply(create('b'))

    expect(board.nextExpiry()).toBe(START + DEMO_CARD_LIFETIME_MS)
  })

  it('refuses a new card once the cap is reached', () => {
    for (let index = 0; index < DEMO_MAX_CARDS; index += 1) {
      board.apply(create(`card-${index}`))
    }

    expect(() => board.apply(create('one-too-many'))).toThrow('full')
    expect(rowCount(db, 'tasks')).toBe(DEMO_MAX_CARDS)
  })

  it('counts cards in history towards the cap', () => {
    for (let index = 0; index < DEMO_MAX_CARDS; index += 1) {
      board.apply(create(`card-${index}`, 'done'))
      board.apply({ type: 'archive', taskId: `card-${index}`, at: 0 } as BoardCommand)
    }

    expect(() => board.apply(create('one-too-many'))).toThrow('full')
  })

  it('makes room again once cards expire', () => {
    for (let index = 0; index < DEMO_MAX_CARDS; index += 1) {
      board.apply(create(`card-${index}`))
    }

    time = START + DEMO_CARD_LIFETIME_MS

    expect(titles(board.apply(create('fresh')))).toEqual(['Card fresh'])
  })

  describe('daily write budget', () => {
    function useWholeBudget() {
      board.apply(create('a'))
      for (let write = 1; write < DEMO_MAX_WRITES_PER_DAY; write += 1) {
        board.apply({ type: 'set-title', taskId: 'a', title: `Title ${write}` })
      }
    }

    it('refuses changes once the day is used up', () => {
      useWholeBudget()

      expect(() =>
        board.apply({ type: 'set-title', taskId: 'a', title: 'One more' }),
      ).toThrow('limit')
    })

    it('also refuses deleting from history', () => {
      useWholeBudget()

      expect(() => board.deleteArchived('a')).toThrow('limit')
    })

    it('still allows reading after the day is used up', () => {
      useWholeBudget()

      expect(titles(board.get())).toHaveLength(1)
    })

    it('starts again the next day and keeps no old counters', () => {
      useWholeBudget()

      time = START + ONE_DAY_MS

      expect(titles(board.apply(create('b')))).toEqual(['Card b'])
      expect(rowCount(db, 'demo_usage')).toBe(1)
    })
  })
})

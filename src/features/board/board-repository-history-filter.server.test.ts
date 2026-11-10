// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { MOCK_HISTORY, insertMockHistory, mockArchivedAt, removeMockHistory } from '../dev/mock-history.server'
import { createBoardRepository } from './board-repository.server'
import { createSeedBoard } from './board-model'
import { NO_HISTORY_FILTER, type HistoryFilter } from './history-filter'

const NOW = Date.UTC(2026, 10, 10, 12)

function filter(overrides: Partial<HistoryFilter>): HistoryFilter {
  return { ...NO_HISTORY_FILTER, ...overrides }
}

describe('History search and dates', () => {
  let db: TestDatabase
  let repository: ReturnType<typeof createBoardRepository>

  beforeEach(() => {
    db = openTestDatabase()
    repository = createBoardRepository({ db, now: () => NOW, seedBoard: createSeedBoard(NOW) })
    insertMockHistory(db, NOW)
  })

  function titles(page: ReturnType<typeof repository.listArchive>): string[] {
    return page.tasks.map(({ title }) => title)
  }

  it('lists all 55 mock cards with no filter, newest first, 20 to a page', () => {
    const page = repository.listArchive(1)

    expect(page).toMatchObject({ total: 55, pageCount: 3 })
    expect(page.tasks).toHaveLength(20)
    expect(repository.listArchive(3).tasks).toHaveLength(15)
    const times = page.tasks.map(({ archivedAt }) => archivedAt)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('finds cards by words in the title, ignoring case', () => {
    const page = repository.listArchive(1, filter({ search: 'INVOICE' }))

    expect(page.total).toBeGreaterThan(0)
    expect(titles(page).every((title) => title.toLowerCase().includes('invoice'))).toBe(true)
  })

  it('treats % and _ as plain characters, not wildcards', () => {
    expect(repository.listArchive(1, filter({ search: '%' })).total).toBe(0)
    expect(repository.listArchive(1, filter({ search: '_' })).total).toBe(0)
  })

  it('pages by the chosen size', () => {
    const fifty = repository.listArchive(1, NO_HISTORY_FILTER, 50)
    const lastOfThirty = repository.listArchive(2, NO_HISTORY_FILTER, 30)

    expect(fifty).toMatchObject({ total: 55, pageCount: 2, pageSize: 50 })
    expect(fifty.tasks).toHaveLength(50)
    expect(lastOfThirty.tasks).toHaveLength(25)
    expect(lastOfThirty.tasks[0].id).toBe(repository.listArchive(1, NO_HISTORY_FILTER, 40).tasks[30].id)
  })

  it('keeps only cards moved to History in the last 3 months', () => {
    const page = repository.listArchive(1, filter({ range: '3m' }))
    const threeMonthsAgo = Date.UTC(2026, 7, 10, 12)
    const expected = MOCK_HISTORY.filter((card) => mockArchivedAt(card, NOW) >= threeMonthsAgo)

    expect(page.total).toBe(expected.length)
    expect(page.tasks.every(({ archivedAt }) => archivedAt >= threeMonthsAgo)).toBe(true)
  })

  it('keeps more cards for 6 months than for 3', () => {
    const three = repository.listArchive(1, filter({ range: '3m' })).total
    const six = repository.listArchive(1, filter({ range: '6m' })).total

    expect(six).toBeGreaterThan(three)
    expect(six).toBeLessThan(20)
  })

  it('finds cards from earlier years with a custom range', () => {
    const in2023 = repository.listArchive(
      1,
      filter({ range: 'custom', from: Date.UTC(2023, 0, 1), to: Date.UTC(2023, 11, 31, 23, 59, 59, 999) }),
    )

    expect(in2023.total).toBe(9)
    expect(in2023.tasks.every(({ archivedAt }) => new Date(archivedAt).getUTCFullYear() === 2023)).toBe(true)
  })

  it('keeps cards inside a custom start and end, both included', () => {
    const all = repository.listArchive(1).tasks
    const [newer, older] = [all[3], all[7]]

    const page = repository.listArchive(
      1,
      filter({ range: 'custom', from: older.archivedAt, to: newer.archivedAt }),
    )

    expect(page.total).toBe(5)
    expect(page.tasks[0].id).toBe(newer.id)
    expect(page.tasks.at(-1)?.id).toBe(older.id)
  })

  it('combines words and dates', () => {
    const words = repository.listArchive(1, filter({ search: 'review' })).total
    const both = repository.listArchive(1, filter({ search: 'review', range: '30d' })).total

    expect(both).toBeLessThan(words)
  })

  it('pages the matches, not the whole history', () => {
    const page = repository.listArchive(5, filter({ range: '30d' }))

    expect(page).toMatchObject({ page: 1, pageCount: 1 })
  })
})

describe('mock History cards', () => {
  it('adds 55 cards once, with their timelines and who moved them', () => {
    const db = openTestDatabase()
    const repository = createBoardRepository({ db, now: () => NOW, seedBoard: createSeedBoard(NOW) })

    expect(insertMockHistory(db, NOW)).toBe(55)
    expect(insertMockHistory(db, NOW)).toBe(0)

    const page = repository.listArchive(1)
    expect(page.total).toBe(55)
    expect(page.tasks.every(({ moves }) => moves.length >= 2)).toBe(true)
    expect(page.tasks.some(({ archivedBy }) => archivedBy?.kind === 'agent')).toBe(true)
    expect(page.tasks.some(({ reason }) => reason === 'expired')).toBe(true)
  })

  it('removes only the mock cards and their timelines', () => {
    const db = openTestDatabase()
    const repository = createBoardRepository({ db, now: () => NOW, seedBoard: createSeedBoard(NOW) })
    repository.apply({ type: 'create', taskId: 'real-1', columnId: 'done', title: 'Real card', at: NOW })
    repository.apply({ type: 'archive', taskId: 'real-1' })
    insertMockHistory(db, NOW)

    expect(removeMockHistory(db)).toBe(55)

    expect(repository.listArchive(1).tasks.map(({ id }) => id)).toEqual(['real-1'])
    expect(db.query("SELECT COUNT(*) AS n FROM task_moves WHERE task_id LIKE 'mock-%'")[0]).toEqual({ n: 0 })
    expect(db.query("SELECT COUNT(*) AS n FROM task_archive_actors WHERE task_id LIKE 'mock-%'")[0]).toEqual({ n: 0 })
  })

  it('leaves the board itself alone', () => {
    const db = openTestDatabase()
    const repository = createBoardRepository({ db, now: () => NOW, seedBoard: createSeedBoard(NOW) })
    const before = repository.get()

    insertMockHistory(db, NOW)

    expect(repository.get()).toEqual(before)
  })
})

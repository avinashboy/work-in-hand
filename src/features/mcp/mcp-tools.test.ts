// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { TaskApiStore } from '../api/task-api-routes.server'
import type { StoredTaskDetail, TaskListPage } from '../board/board-task-queries.server'
import { createBoardToolHandlers } from './mcp-tools'

const AT = Date.UTC(2026, 10, 10, 9, 30)

const storedTask: StoredTaskDetail = {
  id: 'card-1',
  title: 'Call the supplier',
  notes: 'Ask about the March invoice',
  columnId: 'review',
  createdAt: AT,
  movedAt: AT,
  doneAt: null,
  archivedAt: null,
  archiveReason: null,
  archivedBy: null,
  moves: [{ columnId: 'backlog', at: AT }],
  edits: [{ kind: 'title', columnId: 'review', at: AT }],
}

const emptyPage: TaskListPage = { tasks: [], total: 0, page: 1, limit: 50, pageCount: 0 }

function store(overrides: Partial<TaskApiStore> = {}): TaskApiStore {
  return {
    createTask: vi.fn(async ({ title, notes }) => ({
      id: 'new-1',
      title,
      notes,
      createdAt: AT,
      movedAt: AT,
      doneAt: null,
    })),
    listTasks: vi.fn(async () => emptyPage),
    findTask: vi.fn(async () => storedTask),
    summarizeTasks: vi.fn(async () => ({ columns: [], ongoing: 1, completed: 0, archived: 0, total: 1 })),
    updateTask: vi.fn(async () => ({ outcome: 'changed' as const, task: storedTask })),
    removeTask: vi.fn(async () => true),
    archiveTask: vi.fn(async () => ({ outcome: 'changed' as const, task: storedTask })),
    ...overrides,
  }
}

function textOf(result: { content: readonly { type: string; text?: string }[] }): string {
  return result.content.map((part) => part.text ?? '').join('')
}

describe('MCP board tools', () => {
  it('lists cards with filters turned into the API query', async () => {
    const board = store()
    const tools = createBoardToolHandlers(board)

    const result = await tools.list_tasks({
      columns: ['In progress', 'done'],
      archived: false,
      search: 'invoice',
      limit: 10,
    })

    expect(result.isError).toBeUndefined()
    expect(board.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: ['doing', 'done'],
        archived: false,
        search: 'invoice',
        limit: 10,
        page: 1,
        status: 'all',
      }),
    )
    expect(result.structuredContent).toEqual({
      tasks: [],
      meta: { total: 0, page: 1, limit: 50, pageCount: 0 },
    })
  })

  it('refuses a filter the API would refuse, without touching the store', async () => {
    const board = store()
    const result = await createBoardToolHandlers(board).list_tasks({ columns: ['Someday'] })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('column must be')
    expect(board.listTasks).not.toHaveBeenCalled()
  })

  it('lists a month of History by year and month, by number or by name', async () => {
    const board = store()
    const tools = createBoardToolHandlers(board)
    const november2025 = {
      archived: true,
      archivedAfter: Date.UTC(2025, 10, 1),
      archivedBefore: Date.UTC(2025, 11, 1),
      sort: 'archivedAt',
    }

    await tools.list_tasks({ year: 2025, month: 11 })
    await tools.list_tasks({ year: 2025, month: 'November' })

    expect(board.listTasks).toHaveBeenNthCalledWith(1, expect.objectContaining(november2025))
    expect(board.listTasks).toHaveBeenNthCalledWith(2, expect.objectContaining(november2025))
  })

  it('lists the last 30 days of History', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 10, 12))
    const board = store()

    await createBoardToolHandlers(board).list_tasks({ within: '30d' })
    vi.useRealTimers()

    expect(board.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        archived: true,
        archivedAfter: Date.UTC(2026, 10, 12) - 30 * 24 * 60 * 60 * 1000,
        sort: 'archivedAt',
      }),
    )
  })

  it('lists the last two weeks of History', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 10, 12))
    const board = store()

    await createBoardToolHandlers(board).list_tasks({ within: '2 weeks' })
    vi.useRealTimers()

    expect(board.listTasks).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAfter: Date.UTC(2026, 10, 12) - 14 * 24 * 60 * 60 * 1000 }),
    )
  })

  it('refuses a month without a year', async () => {
    const board = store()
    const result = await createBoardToolHandlers(board).list_tasks({ month: 11 })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('year')
    expect(board.listTasks).not.toHaveBeenCalled()
  })

  it('returns a card with its timeline of moves and edits', async () => {
    const result = await createBoardToolHandlers(store()).get_task({ taskId: 'card-1' })

    expect(result.structuredContent).toEqual(
      expect.objectContaining({
        id: 'card-1',
        column: 'review',
        moves: [{ column: 'backlog', at: new Date(AT).toISOString() }],
        edits: [{ kind: 'title', column: 'review', at: new Date(AT).toISOString() }],
      }),
    )
    expect(JSON.parse(textOf(result))).toEqual(result.structuredContent)
  })

  it('says so when a card does not exist', async () => {
    const result = await createBoardToolHandlers(store({ findTask: vi.fn(async () => null) })).get_task({
      taskId: 'gone',
    })

    expect(result).toEqual(
      expect.objectContaining({ isError: true, content: [{ type: 'text', text: 'No card with that id' }] }),
    )
  })

  it('refuses an id that is not a card id', async () => {
    const board = store()
    const result = await createBoardToolHandlers(board).get_task({ taskId: '../../etc' })

    expect(result.isError).toBe(true)
    expect(board.findTask).not.toHaveBeenCalled()
  })

  it('creates a card in Backlog unless another column is named', async () => {
    const board = store()
    const tools = createBoardToolHandlers(board)

    await tools.create_task({ title: '  Book the venue  ' })
    await tools.create_task({ title: 'Review the plan', column: 'in review', notes: 'By Friday' })

    expect(board.createTask).toHaveBeenNthCalledWith(1, { title: 'Book the venue', notes: '', columnId: 'backlog' })
    expect(board.createTask).toHaveBeenNthCalledWith(2, {
      title: 'Review the plan',
      notes: 'By Friday',
      columnId: 'review',
    })
  })

  it('reports a full board when creating a card', async () => {
    const result = await createBoardToolHandlers(store({ createTask: vi.fn(async () => null) })).create_task({
      title: 'One more',
    })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('The board is full')
  })

  it('refuses an empty title', async () => {
    const board = store()
    const result = await createBoardToolHandlers(board).create_task({ title: '   ' })

    expect(result.isError).toBe(true)
    expect(board.createTask).not.toHaveBeenCalled()
  })

  it('updates only the fields that were sent', async () => {
    const board = store()
    await createBoardToolHandlers(board).update_task({ taskId: 'card-1', column: 'Done', position: 0 })

    expect(board.updateTask).toHaveBeenCalledWith('card-1', { columnId: 'done', position: 0 })
  })

  it('refuses an update with nothing to change', async () => {
    const board = store()
    const result = await createBoardToolHandlers(board).update_task({ taskId: 'card-1' })

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Send at least one of')
    expect(board.updateTask).not.toHaveBeenCalled()
  })

  it('explains why a change was refused', async () => {
    const tools = createBoardToolHandlers(
      store({
        updateTask: vi.fn(async () => ({ outcome: 'history' as const })),
        archiveTask: vi.fn(async () => ({ outcome: 'not-done' as const })),
      }),
    )

    expect(textOf(await tools.update_task({ taskId: 'card-1', title: 'New' }))).toBe(
      "That card is in History and can't be changed",
    )
    expect(textOf(await tools.archive_task({ taskId: 'card-1' }))).toBe(
      'Only cards in Done can be moved to History',
    )
  })

  it('records the agent, with its name, as the one who moved a card to History', async () => {
    const board = store()
    await createBoardToolHandlers(board, 'Claude Desktop').archive_task({ taskId: 'card-1' })
    await createBoardToolHandlers(board, null).archive_task({ taskId: 'card-1' })

    expect(board.archiveTask).toHaveBeenNthCalledWith(1, 'card-1', { kind: 'agent', client: 'Claude Desktop' })
    expect(board.archiveTask).toHaveBeenNthCalledWith(2, 'card-1', { kind: 'agent', client: null })
  })

  it('deletes a card and reports a missing one', async () => {
    const deleted = await createBoardToolHandlers(store()).delete_task({ taskId: 'card-1' })
    const missing = await createBoardToolHandlers(store({ removeTask: vi.fn(async () => false) })).delete_task({
      taskId: 'card-1',
    })

    expect(deleted.structuredContent).toEqual({ id: 'card-1', deleted: true })
    expect(missing.isError).toBe(true)
  })

  it('summarises the board', async () => {
    const result = await createBoardToolHandlers(store()).get_board_summary({})

    expect(result.structuredContent).toEqual(expect.objectContaining({ ongoing: 1, total: 1 }))
  })

  it('turns an unexpected store failure into a tool error without leaking details', async () => {
    const result = await createBoardToolHandlers(
      store({ listTasks: vi.fn(async () => Promise.reject(new Error('SQLITE_BUSY at /internal/path'))) }),
    ).list_tasks({})

    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('Something went wrong. Try again in a moment.')
  })
})

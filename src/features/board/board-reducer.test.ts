import { describe, expect, it, vi } from 'vitest'
import { applyCommand, countTasks, resolveDropTarget } from './board-reducer'
import {
  boardCommandSchema,
  createTaskId,
  type Board,
  type ColumnId,
} from './board-model'

const board: Board = {
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      tasks: [
        { id: 'a', title: 'A', notes: '', createdAt: 1000, movedAt: 1000, doneAt: null },
        { id: 'b', title: 'B', notes: '', createdAt: 1000, movedAt: 1000, doneAt: null },
        { id: 'c', title: 'C', notes: '', createdAt: 1000, movedAt: 1000, doneAt: null },
      ],
    },
    { id: 'doing', title: 'Doing', tasks: [{ id: 'd', title: 'D', notes: '', createdAt: 1000, movedAt: 1000, doneAt: null }] },
    { id: 'review', title: 'Review', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] },
  ],
}

function idsIn(target: Board, columnId: ColumnId): string[] {
  const column = target.columns.find(({ id }) => id === columnId)
  return column ? column.tasks.map(({ id }) => id) : []
}

describe('applyCommand: move', () => {
  it('moves a task to a position in another column', () => {
    const next = applyCommand(board, {
      type: 'move',
      taskId: 'a',
      toColumnId: 'doing',
      toIndex: 0,
      at: 1000,
    })

    expect(idsIn(next, 'backlog')).toEqual(['b', 'c'])
    expect(idsIn(next, 'doing')).toEqual(['a', 'd'])
  })

  it('reorders within a column', () => {
    const next = applyCommand(board, {
      type: 'move',
      taskId: 'a',
      toColumnId: 'backlog',
      toIndex: 2,
      at: 1000,
    })

    expect(idsIn(next, 'backlog')).toEqual(['b', 'c', 'a'])
  })

  it('clamps an index past the end of the column', () => {
    const next = applyCommand(board, {
      type: 'move',
      taskId: 'a',
      toColumnId: 'doing',
      toIndex: 99,
      at: 1000,
    })

    expect(idsIn(next, 'doing')).toEqual(['d', 'a'])
  })

  it('returns the same board when the task does not exist', () => {
    const next = applyCommand(board, {
      type: 'move',
      taskId: 'missing',
      toColumnId: 'doing',
      toIndex: 0,
      at: 1000,
    })

    expect(next).toBe(board)
  })

  it('gives the same result when replayed', () => {
    const command = {
      type: 'move',
      taskId: 'a',
      toColumnId: 'doing',
      toIndex: 1,
      at: 1000,
    } as const

    const once = applyCommand(board, command)

    expect(applyCommand(once, command)).toEqual(once)
  })

  it('does not mutate the original board', () => {
    const snapshot = structuredClone(board)

    applyCommand(board, {
      type: 'move',
      taskId: 'a',
      toColumnId: 'doing',
      toIndex: 0,
      at: 1000,
    })

    expect(board).toEqual(snapshot)
  })
})

describe('applyCommand: create', () => {
  it('appends a task to the column', () => {
    const next = applyCommand(board, {
      type: 'create',
      taskId: 'new',
      columnId: 'doing',
      at: 1000,
      title: 'New',
    })

    expect(idsIn(next, 'doing')).toEqual(['d', 'new'])
  })

  it('ignores a task id that already exists', () => {
    const next = applyCommand(board, {
      type: 'create',
      taskId: 'a',
      columnId: 'doing',
      at: 1000,
      title: 'Duplicate',
    })

    expect(next).toBe(board)
  })
})

describe('applyCommand: delete', () => {
  it('removes the task', () => {
    const next = applyCommand(board, { type: 'delete', taskId: 'b' })

    expect(idsIn(next, 'backlog')).toEqual(['a', 'c'])
  })

  it('returns the same board when the task does not exist', () => {
    expect(applyCommand(board, { type: 'delete', taskId: 'missing' })).toBe(
      board,
    )
  })
})

describe('timestamps', () => {
  const taskIn = (target: Board, id: string) =>
    target.columns.flatMap(({ tasks }) => tasks).find((task) => task.id === id)

  it('records when a task was added', () => {
    const next = applyCommand(board, { type: 'create', taskId: 'n', columnId: 'doing', title: 'N', at: 5000 })

    expect(taskIn(next, 'n')).toMatchObject({ createdAt: 5000, doneAt: null })
  })

  it('marks a task added straight into Done as done', () => {
    const next = applyCommand(board, { type: 'create', taskId: 'n', columnId: 'done', title: 'N', at: 5000 })

    expect(taskIn(next, 'n')?.doneAt).toBe(5000)
  })

  it('records when a task reaches Done', () => {
    const next = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'done', toIndex: 0, at: 7000 })

    expect(taskIn(next, 'a')?.doneAt).toBe(7000)
  })

  it('keeps the original done time when reordering inside Done', () => {
    const done = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'done', toIndex: 0, at: 7000 })

    const next = applyCommand(done, { type: 'move', taskId: 'a', toColumnId: 'done', toIndex: 0, at: 9000 })

    expect(taskIn(next, 'a')?.doneAt).toBe(7000)
  })

  it('counts adding a task as landing in its column', () => {
    const next = applyCommand(board, { type: 'create', taskId: 'n', columnId: 'doing', title: 'N', at: 5000 })

    expect(taskIn(next, 'n')?.movedAt).toBe(5000)
  })

  it('records when a task lands in a new column', () => {
    const next = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'review', toIndex: 0, at: 7000 })

    expect(taskIn(next, 'a')?.movedAt).toBe(7000)
  })

  it('does not count reordering inside a column as landing', () => {
    const next = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'backlog', toIndex: 2, at: 7000 })

    expect(taskIn(next, 'a')?.movedAt).toBe(1000)
  })

  it('clears the done time when a task leaves Done', () => {
    const done = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'done', toIndex: 0, at: 7000 })

    const next = applyCommand(done, { type: 'move', taskId: 'a', toColumnId: 'doing', toIndex: 0, at: 9000 })

    expect(taskIn(next, 'a')?.doneAt).toBeNull()
  })
})

describe('applyCommand: archive', () => {
  it('removes a task that is in Done', () => {
    const done = applyCommand(board, { type: 'move', taskId: 'a', toColumnId: 'done', toIndex: 0, at: 7000 })

    const next = applyCommand(done, { type: 'archive', taskId: 'a' })

    expect(idsIn(next, 'done')).toEqual([])
  })

  it('ignores a task that is not in Done', () => {
    expect(applyCommand(board, { type: 'archive', taskId: 'a' })).toBe(board)
  })
})

describe('countTasks', () => {
  it('counts tasks across every column', () => {
    expect(countTasks(board)).toBe(4)
  })
})

describe('resolveDropTarget', () => {
  it('targets the position of the task being hovered', () => {
    expect(resolveDropTarget(board, 'b')).toEqual({
      columnId: 'backlog',
      index: 1,
    })
  })

  it('targets the end of a hovered column', () => {
    expect(resolveDropTarget(board, 'doing')).toEqual({
      columnId: 'doing',
      index: 1,
    })
  })

  it('returns null for an unknown id', () => {
    expect(resolveDropTarget(board, 'nowhere')).toBeNull()
  })
})

describe('boardCommandSchema', () => {
  it('trims a task title', () => {
    const parsed = boardCommandSchema.parse({
      type: 'create',
      taskId: 'x',
      columnId: 'done',
      at: 1000,
      title: '  Ship it  ',
    })

    expect(parsed).toMatchObject({ title: 'Ship it' })
  })

  it.each([
    { type: 'create', taskId: 'x', columnId: 'done', title: '   ' },
    { type: 'move', taskId: 'x', toColumnId: 'nope', toIndex: 0 },
    { type: 'move', taskId: 'x', toColumnId: 'done', toIndex: -1 },
    { type: 'delete', taskId: '' },
    { type: 'delete', taskId: 'doing' },
    { type: 'delete', taskId: 'has spaces' },
    { type: 'explode' },
  ])('rejects invalid command %j', (input) => {
    expect(boardCommandSchema.safeParse(input).success).toBe(false)
  })
})

describe('createTaskId', () => {
  it('creates ids the command schema accepts', () => {
    const command = { type: 'delete', taskId: createTaskId() }

    expect(boardCommandSchema.safeParse(command).success).toBe(true)
  })

  it('creates a different id each time', () => {
    expect(createTaskId()).not.toBe(createTaskId())
  })

  it('works without crypto.randomUUID, as on plain HTTP origins', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
    })

    expect(createTaskId()).toMatch(/^[0-9a-f]{32}$/)

    vi.unstubAllGlobals()
  })
})

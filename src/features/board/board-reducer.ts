import {
  DONE_COLUMN_ID,
  type Board,
  type BoardCommand,
  type Column,
  type ColumnId,
  type Task,
} from './board-model'

export interface DropTarget {
  readonly columnId: ColumnId
  readonly index: number
}

type MoveCommand = Extract<BoardCommand, { type: 'move' }>

function findTask(board: Board, taskId: string): Task | undefined {
  return board.columns
    .flatMap(({ tasks }) => tasks)
    .find(({ id }) => id === taskId)
}

function updateColumn(
  board: Board,
  columnId: ColumnId,
  update: (column: Column) => Column,
): Board {
  return {
    columns: board.columns.map((column) =>
      column.id === columnId ? update(column) : column,
    ),
  }
}

function withoutTask(board: Board, taskId: string): Board {
  return {
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter(({ id }) => id !== taskId),
    })),
  }
}

function withNotes(board: Board, taskId: string, notes: string): Board {
  return {
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) =>
        task.id === taskId ? { ...task, notes } : task,
      ),
    })),
  }
}

function insertTaskAt(
  tasks: readonly Task[],
  task: Task,
  index: number,
): readonly Task[] {
  const position = Math.min(index, tasks.length)
  return [...tasks.slice(0, position), task, ...tasks.slice(position)]
}

function columnOf(board: Board, taskId: string): ColumnId | undefined {
  return board.columns.find(({ tasks }) =>
    tasks.some((task) => task.id === taskId),
  )?.id
}

function moveTask(board: Board, task: Task, command: MoveCommand): Board {
  const moved: Task = {
    ...task,
    movedAt:
      columnOf(board, task.id) === command.toColumnId
        ? task.movedAt
        : command.at,
    doneAt:
      command.toColumnId === DONE_COLUMN_ID ? (task.doneAt ?? command.at) : null,
  }
  return updateColumn(
    withoutTask(board, task.id),
    command.toColumnId,
    (column) => ({
      ...column,
      tasks: insertTaskAt(column.tasks, moved, command.toIndex),
    }),
  )
}

export function applyCommand(board: Board, command: BoardCommand): Board {
  const existing = findTask(board, command.taskId)

  switch (command.type) {
    case 'move':
      return existing ? moveTask(board, existing, command) : board
    case 'create':
      if (existing) return board
      return updateColumn(board, command.columnId, (column) => ({
        ...column,
        tasks: [
          ...column.tasks,
          {
            id: command.taskId,
            title: command.title,
            notes: command.notes ?? '',
            createdAt: command.at,
            movedAt: command.at,
            doneAt: command.columnId === DONE_COLUMN_ID ? command.at : null,
          },
        ],
      }))
    case 'set-notes':
      return existing ? withNotes(board, command.taskId, command.notes) : board
    case 'delete':
      return existing ? withoutTask(board, command.taskId) : board
    case 'archive':
      return columnOf(board, command.taskId) === DONE_COLUMN_ID
        ? withoutTask(board, command.taskId)
        : board
  }
}

export function countTasks(board: Board): number {
  return board.columns.reduce((total, { tasks }) => total + tasks.length, 0)
}

/** Works out where a drag would land from the id of the thing under it. */
export function resolveDropTarget(
  board: Board,
  overId: string,
): DropTarget | null {
  for (const column of board.columns) {
    if (column.id === overId) {
      return { columnId: column.id, index: column.tasks.length }
    }
    const index = column.tasks.findIndex(({ id }) => id === overId)
    if (index !== -1) return { columnId: column.id, index }
  }
  return null
}

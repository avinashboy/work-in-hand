import type { SqlDatabase } from '../../lib/sql-database'
import {
  DONE_COLUMN_ID,
  MAX_TASKS_ON_BOARD,
  type Board,
  type BoardCommand,
  type ColumnId,
} from './board-model'
import {
  findTask,
  listTasks,
  summarizeTasks,
  type StoredTaskDetail,
  type TaskChange,
  type TaskListPage,
  type TaskQuery,
  type TaskSummary,
} from './board-task-queries.server'

export interface TaskPatch {
  readonly title?: string
  readonly notes?: string
  readonly columnId?: ColumnId
  /** Where in the column it goes, 0 being the top. */
  readonly position?: number
}

export interface TaskOperations {
  readonly listTasks: (query: TaskQuery) => TaskListPage
  readonly findTask: (taskId: string) => StoredTaskDetail | null
  readonly summarizeTasks: () => TaskSummary
  readonly updateTask: (taskId: string, patch: TaskPatch) => TaskChange
  /** Works on the board and the history. False when there is no such card. */
  readonly removeTask: (taskId: string) => boolean
  readonly archiveTask: (taskId: string) => TaskChange
}

interface TaskOperationsOptions {
  readonly db: SqlDatabase
  readonly now: () => number
  readonly sweepExpired: () => void
  /** Must run inside a transaction. */
  readonly applyChange: (command: BoardCommand) => Board
  /** Must run inside a transaction. */
  readonly removeFromHistory: (taskId: string) => void
}

function commandsFor(task: StoredTaskDetail, patch: TaskPatch, at: number): readonly BoardCommand[] {
  const taskId = task.id
  const toColumnId = patch.columnId ?? task.columnId
  const isMoving = toColumnId !== task.columnId || patch.position !== undefined

  return [
    ...(patch.title === undefined
      ? []
      : [{ type: 'set-title', taskId, title: patch.title } as const]),
    ...(patch.notes === undefined
      ? []
      : [{ type: 'set-notes', taskId, notes: patch.notes } as const]),
    ...(isMoving
      ? [
          {
            type: 'move',
            taskId,
            toColumnId,
            // Past the end on purpose: the reducer places it last.
            toIndex: patch.position ?? MAX_TASKS_ON_BOARD,
            at,
          } as const,
        ]
      : []),
  ]
}

export function createTaskOperations({
  db,
  now,
  sweepExpired,
  applyChange,
  removeFromHistory,
}: TaskOperationsOptions): TaskOperations {
  const swept = <T>(read: () => T): T =>
    db.transaction(() => {
      sweepExpired()
      return read()
    })

  const changeActive = (
    taskId: string,
    work: (task: StoredTaskDetail) => TaskChange,
  ): TaskChange =>
    swept(() => {
      const task = findTask(db, taskId)
      if (task === null) return { outcome: 'missing' }
      return task.archivedAt === null ? work(task) : { outcome: 'history' }
    })

  const changed = (taskId: string): TaskChange => {
    const task = findTask(db, taskId)
    return task === null ? { outcome: 'missing' } : { outcome: 'changed', task }
  }

  return {
    listTasks: (query) => swept(() => listTasks(db, query)),
    findTask: (taskId) => swept(() => findTask(db, taskId)),
    summarizeTasks: () => swept(() => summarizeTasks(db)),
    updateTask: (taskId, patch) =>
      changeActive(taskId, (task) => {
        commandsFor(task, patch, now()).forEach(applyChange)
        return changed(taskId)
      }),
    removeTask: (taskId) =>
      swept(() => {
        const task = findTask(db, taskId)
        if (task === null) return false
        if (task.archivedAt === null) applyChange({ type: 'delete', taskId })
        else removeFromHistory(taskId)
        return true
      }),
    archiveTask: (taskId) =>
      changeActive(taskId, (task) => {
        if (task.columnId !== DONE_COLUMN_ID) return { outcome: 'not-done' }
        applyChange({ type: 'archive', taskId })
        return changed(taskId)
      }),
  }
}

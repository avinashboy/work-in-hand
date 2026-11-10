import type { StoredTask, StoredTaskDetail, TaskChange } from '../board/board-task-queries.server'

/** How a card looks to outside apps, shared by the REST API and the MCP server. */

export const NO_SUCH_CARD = 'No card with that id'

/** Why a change to a card was refused, by outcome. */
export const CHANGE_REFUSALS: Readonly<Record<Exclude<TaskChange['outcome'], 'changed'>, string>> = {
  missing: NO_SUCH_CARD,
  history: "That card is in History and can't be changed",
  'not-done': 'Only cards in Done can be moved to History',
}

function toIso(time: number | null): string | null {
  return time === null ? null : new Date(time).toISOString()
}

export function toApiTask(task: StoredTask) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    column: task.columnId,
    status: task.doneAt === null ? 'ongoing' : 'completed',
    archived: task.archivedAt !== null,
    archiveReason: task.archiveReason,
    // Who moved it to History: { kind: 'board' | 'api' | 'agent', client }, or null.
    archivedBy: task.archivedBy,
    createdAt: toIso(task.createdAt),
    movedAt: toIso(task.movedAt),
    doneAt: toIso(task.doneAt),
    archivedAt: toIso(task.archivedAt),
  }
}

export function toApiTaskDetail(task: StoredTaskDetail) {
  return {
    ...toApiTask(task),
    moves: task.moves.map(({ columnId, at }) => ({ column: columnId, at: toIso(at) })),
    edits: task.edits.map(({ kind, columnId, at }) => ({ kind, column: columnId, at: toIso(at) })),
  }
}

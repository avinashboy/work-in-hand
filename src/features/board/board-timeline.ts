import {
  COLUMN_TITLES,
  DONE_COLUMN_ID,
  type ArchiveReason,
  type ArchivedTask,
  type ColumnId,
} from './board-model'

export const ARCHIVE_REASON_LABELS: Readonly<Record<ArchiveReason, string>> = {
  confirmed: 'Archive pressed',
  expired: 'After 24 hours',
}

export interface TimelineStep {
  readonly label: string
  readonly detail: string | null
  readonly at: number
  readonly tone: ColumnId | 'history'
}

export interface TaskTimeline {
  readonly steps: readonly TimelineStep[]
  /** True for cards from before moves were recorded. */
  readonly isPartial: boolean
}

function columnName(columnId: ColumnId): string {
  return COLUMN_TITLES[columnId].toLowerCase()
}

export function buildTimeline(task: ArchivedTask): TaskTimeline {
  const firstMove = task.moves.at(0)
  const startMove = firstMove?.at === task.createdAt ? firstMove : undefined
  const laterMoves = startMove ? task.moves.slice(1) : task.moves

  const started: TimelineStep = {
    label: startMove ? `Started in ${columnName(startMove.columnId)}` : 'Started',
    detail: null,
    at: task.createdAt,
    tone: startMove?.columnId ?? 'backlog',
  }
  const landings = laterMoves.map(
    ({ columnId, at }): TimelineStep => ({
      label: columnId === DONE_COLUMN_ID ? 'Done' : `Moved to ${columnName(columnId)}`,
      detail: null,
      at,
      tone: columnId,
    }),
  )
  const filed: TimelineStep = {
    label: 'Moved to history',
    detail: ARCHIVE_REASON_LABELS[task.reason],
    at: task.archivedAt,
    tone: 'history',
  }

  return { steps: [started, ...landings, filed], isPartial: !startMove }
}

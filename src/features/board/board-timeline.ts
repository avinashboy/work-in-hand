import {
  COLUMN_TITLES,
  DONE_COLUMN_ID,
  type ArchiveActor,
  type ArchiveReason,
  type ArchivedTask,
  type ColumnId,
  type TaskEdit,
  type TaskEditKind,
} from './board-model'

export const ARCHIVE_REASON_LABELS: Readonly<Record<ArchiveReason, string>> = {
  confirmed: 'Archive pressed',
  expired: 'After 24 hours',
}

const ACTOR_LABELS: Readonly<Record<ArchiveActor['kind'], string>> = {
  board: 'Archive pressed',
  api: 'Through the API',
  agent: 'AI agent',
}

/** How a card reached History, naming the app or agent when it is known. Shown in the How column and the timeline. */
export function describeArchive({ reason, archivedBy }: Pick<ArchivedTask, 'reason' | 'archivedBy'>): string {
  if (reason === 'expired' || archivedBy === null) return ARCHIVE_REASON_LABELS[reason]
  const label = ACTOR_LABELS[archivedBy.kind]
  return archivedBy.client === null || archivedBy.kind === 'board' ? label : `${label}: ${archivedBy.client}`
}

const EDIT_LABELS: Readonly<Record<TaskEditKind, string>> = {
  title: 'title changed',
  'notes-added': 'notes added',
  'notes-changed': 'notes changed',
  'notes-removed': 'notes removed',
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

function editStep({ kind, columnId, at }: TaskEdit): TimelineStep {
  return {
    label: `${COLUMN_TITLES[columnId]}: ${EDIT_LABELS[kind]}`,
    detail: null,
    at,
    tone: columnId,
  }
}

/** Sorted by time; a move and an edit at the same moment keep the move first. */
function byTime(steps: readonly TimelineStep[]): readonly TimelineStep[] {
  return [...steps].sort((a, b) => a.at - b.at)
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
    detail: describeArchive(task),
    at: task.archivedAt,
    tone: 'history',
  }

  const changes = byTime([...landings, ...task.edits.map(editStep)])

  return { steps: [started, ...changes, filed], isPartial: !startMove }
}

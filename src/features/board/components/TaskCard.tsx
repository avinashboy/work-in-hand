import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DEMO_CARD_LIFETIME_MS, IS_DEMO } from '../../demo/demo-config'
import { ARCHIVE_AFTER_MS, type ColumnId, type Task } from '../board-model'
import { CardTime } from './CardTime'
import { ArchiveIcon } from './icons'
import { TaskEditor } from './TaskEditor'

const TASK_CODE_LENGTH = 4

interface TaskHeadingProps {
  readonly task: Task
  readonly isSaving: boolean
}

function TaskHeading({ task, isSaving }: TaskHeadingProps) {
  return (
    <>
      <span className="task-code" aria-hidden="true">
        {task.id.slice(-TASK_CODE_LENGTH).toUpperCase()}
        {isSaving ? <span className="task-saving"> · saving</span> : null}
      </span>
      <span className="task-title">{task.title}</span>
    </>
  )
}

interface TaskTimesProps {
  readonly task: Task
  readonly dragListeners?: ReturnType<typeof useSortable>['listeners']
}

/**
 * Sits outside the grab button because a button can't hold other buttons.
 * The same listeners keep this part of the card draggable.
 */
function TaskTimes({ task, dragListeners }: TaskTimesProps) {
  // Cards in Done already show their landing time as "Done".
  const hasLanded = task.movedAt !== task.createdAt && task.doneAt === null

  return (
    <div className="task-times" {...dragListeners}>
      <span className="task-meta">
        <CardTime label="Added" value={task.createdAt} />
        {hasLanded ? <CardTime label="Moved here" value={task.movedAt} /> : null}
        {IS_DEMO ? (
          <CardTime label="Deleted" value={task.createdAt + DEMO_CARD_LIFETIME_MS} />
        ) : null}
      </span>
    </div>
  )
}

export function TaskFace({ task, isSaving }: TaskHeadingProps) {
  return (
    <>
      <TaskHeading task={task} isSaving={isSaving} />
      <TaskTimes task={task} />
    </>
  )
}

/** Keeps keyboard users in place when the card holding focus is removed. */
function focusNeighbourOf(deleteButton: HTMLElement) {
  const card = deleteButton.closest('.task')
  const neighbour = card?.nextElementSibling ?? card?.previousElementSibling
  const target =
    neighbour?.querySelector<HTMLElement>('.task-grab') ??
    deleteButton.closest('.column')?.querySelector<HTMLElement>('input')
  target?.focus()
}

interface TaskCardProps {
  readonly task: Task
  readonly columnId: ColumnId
  readonly isSaving: boolean
  readonly onDelete: (taskId: string) => void
  readonly onConfirm: (taskId: string) => void
  readonly onSaveTitle: (taskId: string, title: string) => void
  readonly onSaveNotes: (taskId: string, notes: string) => void
}

export function TaskCard({
  task,
  columnId,
  isSaving,
  onDelete,
  onConfirm,
  onSaveTitle,
  onSaveNotes,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', columnId } })

  return (
    <li
      ref={setNodeRef}
      className="task"
      data-dragging={isDragging}
      data-saving={isSaving}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="task-grab"
        {...attributes}
        {...listeners}
      >
        <TaskHeading task={task} isSaving={isSaving} />
      </button>
      <TaskTimes task={task} dragListeners={listeners} />
      <TaskEditor task={task} onSaveTitle={onSaveTitle} onSaveNotes={onSaveNotes} />
      <button
        type="button"
        className="task-delete"
        aria-label={`Delete ${task.title}`}
        onClick={(event) => {
          focusNeighbourOf(event.currentTarget)
          onDelete(task.id)
        }}
      >
        ×
      </button>
      {task.doneAt !== null ? (
        <div className="task-finish">
          <span className="task-meta">
            <CardTime label="Done" value={task.doneAt} />
            {IS_DEMO ? null : (
              <CardTime
                label="Goes to history"
                value={task.doneAt + ARCHIVE_AFTER_MS}
              />
            )}
          </span>
          <button
            type="button"
            className="task-archive"
            title="Move to history"
            aria-label={`Move ${task.title} to history`}
            onClick={(event) => {
              focusNeighbourOf(event.currentTarget)
              onConfirm(task.id)
            }}
          >
            <ArchiveIcon />
          </button>
        </div>
      ) : null}
    </li>
  )
}

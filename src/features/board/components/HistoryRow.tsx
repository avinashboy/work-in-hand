import { useId, useState } from 'react'
import type { ArchivedTask } from '../board-model'
import { buildTimeline, describeArchive } from '../board-timeline'
import { HistoryDelete } from './HistoryDelete'
import { Timestamp } from './Timestamp'

export const COLUMN_COUNT = 6

function TaskTimelineList({ task }: { readonly task: ArchivedTask }) {
  const { steps, isPartial } = buildTimeline(task)

  return (
    <>
      <ol className="timeline">
        {steps.map((step, index) => (
          <li key={index} className="timeline-step" data-tone={step.tone}>
            <span className="timeline-label">{step.label}</span>
            <span className="timeline-time">
              <Timestamp value={step.at} />
              {step.detail ? ` · ${step.detail}` : null}
            </span>
          </li>
        ))}
      </ol>
      {isPartial ? (
        <p className="timeline-note">
          Moves made before timelines were added weren't recorded.
        </p>
      ) : null}
    </>
  )
}

interface HistoryRowProps {
  readonly task: ArchivedTask
  readonly isDeleting: boolean
  readonly onDelete: (taskId: string) => void
}

export function HistoryRow({ task, isDeleting, onDelete }: HistoryRowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()

  return (
    <>
      {/* The button gives keyboard and screen reader access; its click bubbles here. */}
      <tr
        className="history-row"
        data-open={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <th scope="row">
          <button
            type="button"
            className="history-toggle"
            aria-expanded={isOpen}
            aria-controls={isOpen ? panelId : undefined}
          >
            {task.title}
          </button>
        </th>
        <td data-label="Added">
          <Timestamp value={task.createdAt} />
        </td>
        <td data-label="Done">
          <Timestamp value={task.doneAt} />
        </td>
        <td data-label="Moved here">
          <Timestamp value={task.archivedAt} />
        </td>
        <td data-label="How">{describeArchive(task)}</td>
        {/* Stops here so that deleting never opens or closes the timeline. */}
        <td className="history-actions" onClick={(event) => event.stopPropagation()}>
          <HistoryDelete
            title={task.title}
            isDeleting={isDeleting}
            onConfirm={() => onDelete(task.id)}
          />
        </td>
      </tr>
      {isOpen ? (
        <tr className="history-detail">
          <td id={panelId} colSpan={COLUMN_COUNT}>
            {task.notes ? <p className="history-notes">{task.notes}</p> : null}
            <TaskTimelineList task={task} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

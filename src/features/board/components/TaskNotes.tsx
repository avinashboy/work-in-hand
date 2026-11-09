import { useId, useRef, useState, type FormEvent } from 'react'
import { MAX_NOTES_LENGTH, type Task } from '../board-model'

const NOTES_ROWS = 12

interface TaskNotesProps {
  readonly task: Task
  readonly onSave: (taskId: string, notes: string) => void
}

export function TaskNotes({ task, onSave }: TaskNotesProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(task.notes)
  const titleId = useId()
  const fieldId = useId()

  function open() {
    // Starts from the saved notes, so an abandoned edit never comes back.
    setDraft(task.notes)
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (draft !== task.notes) onSave(task.id, draft)
    close()
  }

  return (
    <div className="task-notes">
      <button
        type="button"
        className="task-notes-open"
        aria-label={`Notes for ${task.title}`}
        data-empty={task.notes === ''}
        onClick={open}
      >
        {task.notes === '' ? 'Add notes' : task.notes}
      </button>

      <dialog ref={dialogRef} className="notes-dialog" aria-labelledby={titleId}>
        <form onSubmit={save}>
          <h2 id={titleId}>{task.title}</h2>
          <label htmlFor={fieldId}>Notes</label>
          <textarea
            id={fieldId}
            rows={NOTES_ROWS}
            maxLength={MAX_NOTES_LENGTH}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="notes-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="notes-save">
              Save notes
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}

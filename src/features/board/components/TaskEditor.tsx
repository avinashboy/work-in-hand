import { useId, useRef, useState, type FormEvent } from 'react'
import { MAX_NOTES_LENGTH, MAX_TITLE_LENGTH, type Task } from '../board-model'
import { PencilIcon } from './icons'

const NOTES_ROWS = 12

interface Draft {
  readonly title: string
  readonly notes: string
}

interface EditorFormProps {
  readonly draft: Draft
  readonly onChange: (draft: Draft) => void
  readonly onCancel: () => void
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly headingId: string
}

function EditorForm({ draft, onChange, onCancel, onSubmit, headingId }: EditorFormProps) {
  const titleId = useId()
  const notesId = useId()

  return (
    <form onSubmit={onSubmit}>
      <h2 id={headingId}>Edit card</h2>
      <label htmlFor={titleId}>Title</label>
      <input
        id={titleId}
        type="text"
        maxLength={MAX_TITLE_LENGTH}
        value={draft.title}
        onChange={(event) => onChange({ ...draft, title: event.target.value })}
      />
      <label htmlFor={notesId}>Notes</label>
      <textarea
        id={notesId}
        rows={NOTES_ROWS}
        maxLength={MAX_NOTES_LENGTH}
        value={draft.notes}
        onChange={(event) => onChange({ ...draft, notes: event.target.value })}
      />
      <div className="card-editor-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="card-editor-save" disabled={draft.title.trim() === ''}>
          Save
        </button>
      </div>
    </form>
  )
}

interface TaskEditorProps {
  readonly task: Task
  readonly onSaveTitle: (taskId: string, title: string) => void
  readonly onSaveNotes: (taskId: string, notes: string) => void
}

export function TaskEditor({ task, onSaveTitle, onSaveNotes }: TaskEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState<Draft>(task)
  const headingId = useId()

  function open() {
    // Starts from the saved card, so an abandoned edit never comes back.
    setDraft({ title: task.title, notes: task.notes })
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    if (title !== task.title) onSaveTitle(task.id, title)
    if (draft.notes !== task.notes) onSaveNotes(task.id, draft.notes)
    close()
  }

  return (
    <>
      <button
        type="button"
        className="task-edit"
        title="Edit card"
        aria-label={`Edit ${task.title}`}
        onClick={open}
      >
        <PencilIcon />
      </button>
      <div className="task-notes">
        <button
          type="button"
          className="task-notes-open"
          aria-label={`Notes for ${task.title}`}
          data-empty={task.notes === ''}
          onClick={() => {
            open()
            dialogRef.current?.querySelector('textarea')?.focus()
          }}
        >
          {task.notes === '' ? 'Add notes' : task.notes}
        </button>
      </div>
      <dialog ref={dialogRef} className="card-editor" aria-labelledby={headingId}>
        <EditorForm
          draft={draft}
          onChange={setDraft}
          onCancel={close}
          onSubmit={save}
          headingId={headingId}
        />
      </dialog>
    </>
  )
}

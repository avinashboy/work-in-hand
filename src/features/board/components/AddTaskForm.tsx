import { useId, useState, type FormEvent } from 'react'
import { MAX_TITLE_LENGTH, taskTitleSchema } from '../board-model'
import { describeUnsafeText } from '../safe-text'

interface AddTaskFormProps {
  readonly columnTitle: string
  readonly onSubmit: (title: string) => void
  /** True when no more cards can be added, such as on a full demo board. */
  readonly isDisabled?: boolean
}

export function AddTaskForm({ columnTitle, onSubmit, isDisabled = false }: AddTaskFormProps) {
  const [draft, setDraft] = useState('')
  const errorId = useId()
  const problem = describeUnsafeText(draft)
  const fullNote = isDisabled ? ' (the board is full)' : ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isDisabled || problem !== null) return
    const title = taskTitleSchema.safeParse(draft)
    if (!title.success) return
    onSubmit(title.data)
    setDraft('')
  }

  return (
    <form className="add-task" onSubmit={handleSubmit} data-disabled={isDisabled}>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_TITLE_LENGTH}
        placeholder={isDisabled ? 'Board is full' : 'Add a card'}
        aria-label={`Add a card to ${columnTitle}${fullNote}`}
        aria-invalid={problem !== null}
        aria-describedby={problem === null ? undefined : errorId}
        disabled={isDisabled}
      />
      <button
        type="submit"
        aria-label={`Add card to ${columnTitle}${fullNote}`}
        disabled={isDisabled || problem !== null}
      >
        +
      </button>
      {problem === null ? null : (
        <p id={errorId} className="text-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  )
}

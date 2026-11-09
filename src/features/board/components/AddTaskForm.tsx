import { useState, type FormEvent } from 'react'
import { MAX_TITLE_LENGTH, taskTitleSchema } from '../board-model'

interface AddTaskFormProps {
  readonly columnTitle: string
  readonly onSubmit: (title: string) => void
}

export function AddTaskForm({ columnTitle, onSubmit }: AddTaskFormProps) {
  const [draft, setDraft] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskTitleSchema.safeParse(draft)
    if (!title.success) return
    onSubmit(title.data)
    setDraft('')
  }

  return (
    <form className="add-task" onSubmit={handleSubmit}>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="Add a card"
        aria-label={`Add a card to ${columnTitle}`}
      />
      <button type="submit" aria-label={`Add card to ${columnTitle}`}>
        +
      </button>
    </form>
  )
}

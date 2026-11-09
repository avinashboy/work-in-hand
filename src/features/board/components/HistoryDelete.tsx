import { useState } from 'react'
import { TrashIcon } from './icons'

type Step = 'idle' | 'confirming' | 'kept'

/** Keeps keyboard users in place when the row holding focus goes away. */
function focusNeighbourOf(button: HTMLElement) {
  const row = button.closest('tr')
  const rows = Array.from(document.querySelectorAll('.history-row'))
  const index = rows.findIndex((candidate) => candidate === row)
  const neighbour = rows.at(index + 1) ?? (index > 0 ? rows.at(index - 1) : undefined)
  const target =
    neighbour?.querySelector<HTMLElement>('.history-toggle') ??
    document.querySelector<HTMLElement>('.history-link')
  target?.focus()
}

interface HistoryDeleteProps {
  readonly title: string
  readonly isDeleting: boolean
  readonly onConfirm: () => void
}

/** Deleting can't be undone, so it always takes a second, deliberate press. */
export function HistoryDelete({ title, isDeleting, onConfirm }: HistoryDeleteProps) {
  const [step, setStep] = useState<Step>('idle')

  if (step !== 'confirming') {
    return (
      <button
        type="button"
        className="history-delete"
        title="Delete"
        aria-label={`Delete ${title} from history`}
        autoFocus={step === 'kept'}
        onClick={() => setStep('confirming')}
      >
        <TrashIcon />
      </button>
    )
  }

  return (
    <div className="history-confirm" role="group" aria-label={`Delete ${title}?`}>
      <button
        type="button"
        className="history-confirm-delete"
        disabled={isDeleting}
        onClick={(event) => {
          focusNeighbourOf(event.currentTarget)
          onConfirm()
        }}
      >
        {isDeleting ? 'Deleting…' : 'Delete forever'}
      </button>
      <button
        type="button"
        className="history-confirm-keep"
        disabled={isDeleting}
        autoFocus
        onClick={() => setStep('kept')}
      >
        Keep
      </button>
    </div>
  )
}

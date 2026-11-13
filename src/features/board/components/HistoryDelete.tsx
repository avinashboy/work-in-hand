import { useId, useRef, type MouseEvent } from 'react'
import { TrashIcon } from './icons'

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

/** Deleting can't be undone, so it always asks first, in a modal. */
export function HistoryDelete({ title, isDeleting, onConfirm }: HistoryDeleteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const messageId = useId()

  function open() {
    dialogRef.current?.showModal()
    // The safe choice takes the keyboard first.
    keepRef.current?.focus()
  }

  function keep() {
    dialogRef.current?.close()
    triggerRef.current?.focus()
  }

  function confirm() {
    dialogRef.current?.close()
    if (triggerRef.current) focusNeighbourOf(triggerRef.current)
    onConfirm()
  }

  // A click that lands on the dialog itself, not its panel, is on the backdrop.
  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) keep()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="history-delete"
        title={isDeleting ? 'Deleting…' : 'Delete'}
        aria-label={`Delete ${title} from history`}
        aria-busy={isDeleting}
        disabled={isDeleting}
        onClick={open}
      >
        <TrashIcon />
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={headingId}
        aria-describedby={messageId}
        onClick={closeOnBackdrop}
        onCancel={(event) => {
          // Escape: close through keep() so focus goes back to the trash button.
          event.preventDefault()
          keep()
        }}
      >
        <div className="confirm-dialog-panel">
          <p className="confirm-dialog-kicker">Delete from history</p>
          <h2 id={headingId}>Delete this card for good?</h2>
          <p id={messageId} className="confirm-dialog-message">
            <span className="confirm-dialog-title">{title}</span> and its timeline will be
            gone. This can't be undone.
          </p>
          <div className="confirm-dialog-actions">
            <button ref={keepRef} type="button" className="confirm-dialog-keep" onClick={keep}>
              Keep
            </button>
            <button type="button" className="confirm-dialog-delete" onClick={confirm}>
              Delete forever
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}

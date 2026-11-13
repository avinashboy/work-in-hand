import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ArchivedTask } from '../board-model'
import { HistoryRow } from './HistoryRow'

const task: ArchivedTask = {
  id: 't1',
  title: 'Ship the report',
  notes: '',
  createdAt: 1_000_000,
  doneAt: 3_000_000,
  archivedAt: 4_000_000,
  reason: 'expired',
  archivedBy: null,
  moves: [
    { columnId: 'backlog', at: 1_000_000 },
    { columnId: 'doing', at: 2_000_000 },
    { columnId: 'done', at: 3_000_000 },
  ],
  edits: [],
}

const onDelete = vi.fn()

function renderRow(row: ArchivedTask = task) {
  render(
    <table>
      <tbody>
        <HistoryRow task={row} isDeleting={false} onDelete={onDelete} />
      </tbody>
    </table>,
  )
  return screen.getByRole('button', { name: 'Ship the report' })
}

const deleteButton = () =>
  screen.getByRole('button', { name: 'Delete Ship the report from history' })
const dialogButton = (name: string) => screen.getByRole('button', { name, hidden: true })
const isDialogOpen = () => screen.getByRole('dialog', { hidden: true }).hasAttribute('open')

beforeAll(() => {
  // jsdom doesn't implement these parts of <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  cleanup()
  onDelete.mockClear()
})

describe('HistoryRow: notes', () => {
  it('shows the notes once the row is opened', () => {
    const toggle = renderRow({ ...task, notes: 'Sent to finance' })

    expect(screen.queryByText('Sent to finance')).toBeNull()
    fireEvent.click(toggle)

    expect(screen.getByText('Sent to finance')).toBeTruthy()
  })
})

describe('HistoryRow: deleting', () => {
  it('keeps the confirmation modal closed at first', () => {
    renderRow()

    expect(isDialogOpen()).toBe(false)
  })

  it('opens a confirmation modal instead of deleting on the first click', () => {
    renderRow()

    fireEvent.click(deleteButton())

    expect(onDelete).not.toHaveBeenCalled()
    expect(isDialogOpen()).toBe(true)
  })

  it('names the card in the modal', () => {
    renderRow()

    fireEvent.click(deleteButton())

    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.textContent).toContain('Ship the report')
  })

  it('deletes once it is confirmed, and closes the modal', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(dialogButton('Delete forever'))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('t1')
    expect(isDialogOpen()).toBe(false)
  })

  it('keeps the card when asked to', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(dialogButton('Keep'))

    expect(onDelete).not.toHaveBeenCalled()
    expect(isDialogOpen()).toBe(false)
  })

  it('keeps the card when Escape closes the modal', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent(screen.getByRole('dialog', { hidden: true }), new Event('cancel', { cancelable: true }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(isDialogOpen()).toBe(false)
  })

  it('keeps the card when the backdrop is clicked', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole('dialog', { hidden: true }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(isDialogOpen()).toBe(false)
  })

  it('stays open for a click inside the panel', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByText('Delete this card for good?'))

    expect(isDialogOpen()).toBe(true)
  })

  it('puts the keyboard on the safe choice first', () => {
    renderRow()

    fireEvent.click(deleteButton())

    expect(document.activeElement).toBe(dialogButton('Keep'))
  })

  it('returns the keyboard to the delete button after keeping', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(dialogButton('Keep'))

    expect(document.activeElement).toBe(deleteButton())
  })

  it('does not open the timeline', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(dialogButton('Keep'))
    fireEvent.click(deleteButton())
    fireEvent.click(dialogButton('Delete forever'))

    expect(screen.queryByText('Started in backlog')).toBeNull()
  })

  it('cannot be pressed again while deleting', () => {
    render(
      <table>
        <tbody>
          <HistoryRow task={task} isDeleting onDelete={onDelete} />
        </tbody>
      </table>,
    )

    expect(deleteButton().hasAttribute('disabled')).toBe(true)
  })
})

describe('HistoryRow', () => {
  it('keeps the timeline closed at first', () => {
    const toggle = renderRow()

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Moved to in progress')).toBeNull()
  })

  it('opens the timeline when the card is clicked', () => {
    const toggle = renderRow()

    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Started in backlog')).toBeTruthy()
    expect(screen.getByText('Moved to in progress')).toBeTruthy()
    expect(screen.getByText('Moved to history')).toBeTruthy()
  })

  it('opens from a click anywhere on the row', () => {
    renderRow()

    fireEvent.click(screen.getByText('After 24 hours'))

    expect(screen.getByText('Moved to in progress')).toBeTruthy()
  })

  it('closes again on a second click', () => {
    const toggle = renderRow()

    fireEvent.click(toggle)
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Moved to in progress')).toBeNull()
  })

  it('links the button to the timeline it opens', () => {
    const toggle = renderRow()

    fireEvent.click(toggle)

    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(panel?.textContent).toContain('Started in backlog')
  })

  it('shows title and notes edits in the timeline', () => {
    const toggle = renderRow({
      ...task,
      edits: [
        { kind: 'title', columnId: 'doing', at: 2_500_000 },
        { kind: 'notes-added', columnId: 'done', at: 3_500_000 },
      ],
    })

    fireEvent.click(toggle)

    expect(screen.getByText('In progress: title changed')).toBeTruthy()
    expect(screen.getByText('Done: notes added')).toBeTruthy()
  })

  it('explains when earlier moves were not recorded', () => {
    const toggle = renderRow({
      ...task,
      moves: [{ columnId: 'done', at: 3_000_000 }],
    })

    fireEvent.click(toggle)

    expect(screen.getByText(/weren.t recorded/)).toBeTruthy()
  })

  it('has no such note for a complete timeline', () => {
    const toggle = renderRow()

    fireEvent.click(toggle)

    expect(screen.queryByText(/weren.t recorded/)).toBeNull()
  })
})

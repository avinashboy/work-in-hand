import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ArchivedTask } from '../board-model'
import { HistoryRow } from './HistoryRow'

const task: ArchivedTask = {
  id: 't1',
  title: 'Ship the report',
  createdAt: 1_000_000,
  doneAt: 3_000_000,
  archivedAt: 4_000_000,
  reason: 'expired',
  moves: [
    { columnId: 'backlog', at: 1_000_000 },
    { columnId: 'doing', at: 2_000_000 },
    { columnId: 'done', at: 3_000_000 },
  ],
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

afterEach(() => {
  cleanup()
  onDelete.mockClear()
})

describe('HistoryRow: deleting', () => {
  it('does not delete on the first click', () => {
    renderRow()

    fireEvent.click(deleteButton())

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeTruthy()
  })

  it('deletes once it is confirmed', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('t1')
  })

  it('keeps the card when asked to', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Delete forever' })).toBeNull()
  })

  it('puts the keyboard on the safe choice first', () => {
    renderRow()

    fireEvent.click(deleteButton())

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep' }))
  })

  it('returns the keyboard to the delete button after keeping', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    expect(document.activeElement).toBe(deleteButton())
  })

  it('does not open the timeline', () => {
    renderRow()

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))

    expect(screen.queryByText('Started in backlog')).toBeNull()
  })

  it('cannot be pressed twice while deleting', () => {
    renderRowConfirmingWhileDeleting()

    const button = screen.getByRole('button', { name: 'Deleting…' })
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})

function renderRowConfirmingWhileDeleting() {
  const { rerender } = render(
    <table>
      <tbody>
        <HistoryRow task={task} isDeleting={false} onDelete={onDelete} />
      </tbody>
    </table>,
  )
  fireEvent.click(deleteButton())
  rerender(
    <table>
      <tbody>
        <HistoryRow task={task} isDeleting onDelete={onDelete} />
      </tbody>
    </table>,
  )
}

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

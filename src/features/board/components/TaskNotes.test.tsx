import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MAX_NOTES_LENGTH, type Task } from '../board-model'
import { TaskNotes } from './TaskNotes'

const task: Task = {
  id: 't1',
  title: 'Ship the report',
  notes: '',
  createdAt: 1000,
  movedAt: 1000,
  doneAt: null,
}

const onSave = vi.fn()

function openEditor(current: Task = task) {
  render(<TaskNotes task={current} onSave={onSave} />)
  fireEvent.click(screen.getByRole('button', { name: `Notes for ${current.title}` }))
}

function field() {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Notes', hidden: true })
}

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
  onSave.mockClear()
})

describe('TaskNotes', () => {
  it('offers to add notes on a card without any', () => {
    render(<TaskNotes task={task} onSave={onSave} />)

    expect(screen.getByRole('button', { name: 'Notes for Ship the report' }).textContent).toContain(
      'Add notes',
    )
  })

  it('previews existing notes on the card', () => {
    render(<TaskNotes task={{ ...task, notes: 'Check the totals' }} onSave={onSave} />)

    expect(screen.getByRole('button', { name: 'Notes for Ship the report' }).textContent).toBe(
      'Check the totals',
    )
    expect(screen.queryByText('Add notes')).toBeNull()
  })

  it('opens with the card’s current notes and limit', () => {
    openEditor({ ...task, notes: 'Current text' })

    expect(field().value).toBe('Current text')
    expect(field().maxLength).toBe(MAX_NOTES_LENGTH)
  })

  it('saves changed notes and closes', () => {
    openEditor()

    fireEvent.change(field(), { target: { value: 'New details' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes', hidden: true }))

    expect(onSave).toHaveBeenCalledWith('t1', 'New details')
    expect(screen.getByRole('dialog', { hidden: true }).hasAttribute('open')).toBe(false)
  })

  it('does not save when nothing changed', () => {
    openEditor({ ...task, notes: 'Same' })

    fireEvent.click(screen.getByRole('button', { name: 'Save notes', hidden: true }))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('discards edits on cancel', () => {
    openEditor({ ...task, notes: 'Original' })

    fireEvent.change(field(), { target: { value: 'Abandoned' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))

    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Notes for Ship the report', hidden: true }))
    expect(field().value).toBe('Original')
  })
})

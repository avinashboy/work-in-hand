import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MAX_NOTES_LENGTH, MAX_TITLE_LENGTH, type Task } from '../board-model'
import { TaskEditor } from './TaskEditor'

const task: Task = {
  id: 't1',
  title: 'Ship the report',
  notes: '',
  createdAt: 1000,
  movedAt: 1000,
  doneAt: null,
}

const onSaveTitle = vi.fn()
const onSaveNotes = vi.fn()

function renderEditor(current: Task = task) {
  render(<TaskEditor task={current} onSaveTitle={onSaveTitle} onSaveNotes={onSaveNotes} />)
}

function openEditor(current: Task = task) {
  renderEditor(current)
  fireEvent.click(screen.getByRole('button', { name: `Edit ${current.title}` }))
}

const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name, hidden: true })
const titleField = () =>
  screen.getByRole<HTMLInputElement>('textbox', { name: 'Title', hidden: true })
const notesField = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Notes', hidden: true })
const isOpen = () => screen.getByRole('dialog', { hidden: true }).hasAttribute('open')

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
  onSaveTitle.mockClear()
  onSaveNotes.mockClear()
})

describe('TaskEditor: on the card', () => {
  it('offers to add notes on a card without any', () => {
    renderEditor()

    expect(button('Notes for Ship the report').textContent).toBe('Add notes')
  })

  it('previews existing notes', () => {
    renderEditor({ ...task, notes: 'Check the totals' })

    expect(button('Notes for Ship the report').textContent).toBe('Check the totals')
  })

  it('puts the cursor on the notes when opened from the notes', () => {
    renderEditor()

    fireEvent.click(button('Notes for Ship the report'))

    expect(isOpen()).toBe(true)
    expect(document.activeElement).toBe(notesField())
  })
})

describe('TaskEditor: editing', () => {
  it('opens with the card’s current text and limits', () => {
    openEditor({ ...task, notes: 'Current text' })

    expect(titleField().value).toBe('Ship the report')
    expect(titleField().maxLength).toBe(MAX_TITLE_LENGTH)
    expect(notesField().value).toBe('Current text')
    expect(notesField().maxLength).toBe(MAX_NOTES_LENGTH)
  })

  it('saves only the title when only the title changed', () => {
    openEditor()

    fireEvent.change(titleField(), { target: { value: 'Ship it' } })
    fireEvent.click(button('Save'))

    expect(onSaveTitle).toHaveBeenCalledWith('t1', 'Ship it')
    expect(onSaveNotes).not.toHaveBeenCalled()
    expect(isOpen()).toBe(false)
  })

  it('saves only the notes when only the notes changed', () => {
    openEditor()

    fireEvent.change(notesField(), { target: { value: 'New details' } })
    fireEvent.click(button('Save'))

    expect(onSaveNotes).toHaveBeenCalledWith('t1', 'New details')
    expect(onSaveTitle).not.toHaveBeenCalled()
  })

  it('saves both when both changed', () => {
    openEditor()

    fireEvent.change(titleField(), { target: { value: 'Ship it' } })
    fireEvent.change(notesField(), { target: { value: 'New details' } })
    fireEvent.click(button('Save'))

    expect(onSaveTitle).toHaveBeenCalledWith('t1', 'Ship it')
    expect(onSaveNotes).toHaveBeenCalledWith('t1', 'New details')
  })

  it('trims the title before saving', () => {
    openEditor()

    fireEvent.change(titleField(), { target: { value: '  Ship it  ' } })
    fireEvent.click(button('Save'))

    expect(onSaveTitle).toHaveBeenCalledWith('t1', 'Ship it')
  })

  it('saves nothing when nothing really changed', () => {
    openEditor()

    fireEvent.change(titleField(), { target: { value: ' Ship the report ' } })
    fireEvent.click(button('Save'))

    expect(onSaveTitle).not.toHaveBeenCalled()
    expect(onSaveNotes).not.toHaveBeenCalled()
    expect(isOpen()).toBe(false)
  })

  it('will not save a blank title', () => {
    openEditor()

    fireEvent.change(titleField(), { target: { value: '   ' } })

    expect(button('Save').disabled).toBe(true)
  })

  it('discards edits on cancel', () => {
    openEditor({ ...task, notes: 'Original' })

    fireEvent.change(titleField(), { target: { value: 'Abandoned' } })
    fireEvent.change(notesField(), { target: { value: 'Abandoned' } })
    fireEvent.click(button('Cancel'))

    expect(onSaveTitle).not.toHaveBeenCalled()
    expect(onSaveNotes).not.toHaveBeenCalled()
    fireEvent.click(button('Edit Ship the report'))
    expect(titleField().value).toBe('Ship the report')
    expect(notesField().value).toBe('Original')
  })
})

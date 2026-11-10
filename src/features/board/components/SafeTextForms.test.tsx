import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Task } from '../board-model'

vi.mock('../../demo/demo-config', () => ({ IS_DEMO: true }))

const { AddTaskForm } = await import('./AddTaskForm')
const { TaskEditor } = await import('./TaskEditor')

const task: Task = {
  id: 't1',
  title: 'Ship the report',
  notes: '',
  createdAt: 1000,
  movedAt: 1000,
  doneAt: null,
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

afterEach(cleanup)

describe('adding a card on the demo', () => {
  const onSubmit = vi.fn()

  function typeTitle(value: string) {
    render(<AddTaskForm columnTitle="Backlog" onSubmit={onSubmit} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value } })
  }

  it('says which characters to remove and blocks adding', () => {
    typeTitle('<script>alert(1)</script>')

    expect(screen.getByRole('alert').textContent).toContain('Remove < >')
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true')
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('adds nothing even if the form is submitted anyway', () => {
    typeTitle('<img src=x onerror=alert(1)>')

    fireEvent.submit(screen.getByRole('textbox').closest('form') as HTMLFormElement)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('adds everyday text, including the word alert', () => {
    typeTitle('hello, alert! 10:30 (urgent)')

    fireEvent.click(screen.getByRole('button'))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(onSubmit).toHaveBeenCalledWith('hello, alert! 10:30 (urgent)')
  })
})

describe('editing a card on the demo', () => {
  const onSaveTitle = vi.fn()
  const onSaveNotes = vi.fn()

  function openEditor() {
    render(<TaskEditor task={task} onSaveTitle={onSaveTitle} onSaveNotes={onSaveNotes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ship the report' }))
  }

  function save() {
    return screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement
  }

  it('refuses HTML in the notes and keeps Save off', () => {
    openEditor()

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '<b>bold</b>' } })

    expect(screen.getByRole('alert').textContent).toContain('Remove < >')
    expect(save().disabled).toBe(true)
  })

  it('refuses a template in the title and saves nothing', () => {
    openEditor()

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '`${alert(1)}`' } })
    fireEvent.submit(save().closest('form') as HTMLFormElement)

    expect(onSaveTitle).not.toHaveBeenCalled()
  })

  it('saves everyday notes', () => {
    openEditor()

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Call at 10:30 & ask!' } })
    fireEvent.click(save())

    expect(onSaveNotes).toHaveBeenCalledWith('t1', 'Call at 10:30 & ask!')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AddTaskForm } from './AddTaskForm'

const onSubmit = vi.fn()

function field(): HTMLInputElement {
  return screen.getByRole('textbox', { name: /^Add a card to Backlog/ })
}

function addButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Add card to Backlog/ })
}

afterEach(() => {
  cleanup()
  onSubmit.mockClear()
})

describe('AddTaskForm', () => {
  it('adds a card and clears the field', () => {
    render(<AddTaskForm columnTitle="Backlog" onSubmit={onSubmit} />)

    fireEvent.change(field(), { target: { value: 'New card' } })
    fireEvent.click(addButton())

    expect(onSubmit).toHaveBeenCalledWith('New card')
    expect(field().value).toBe('')
  })

  it('turns off the field and button when disabled', () => {
    render(<AddTaskForm columnTitle="Backlog" onSubmit={onSubmit} isDisabled />)

    expect(field().disabled).toBe(true)
    expect(addButton().disabled).toBe(true)
    expect(field().placeholder).toBe('Board is full')
    expect(field().getAttribute('aria-label')).toBe('Add a card to Backlog (the board is full)')
  })

  it('adds nothing when disabled, even if the form is submitted', () => {
    const { container } = render(
      <AddTaskForm columnTitle="Backlog" onSubmit={onSubmit} isDisabled />,
    )

    fireEvent.change(field(), { target: { value: 'Sneaky card' } })
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

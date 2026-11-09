import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import type { Column, Task } from '../board-model'
import { BoardColumn } from './BoardColumn'

const LIST_HEIGHT = 900

function task(id: string): Task {
  return { id, title: `Card ${id}`, notes: '', createdAt: 1000, movedAt: 1000, doneAt: null }
}

function backlog(ids: readonly string[]): Column {
  return { id: 'backlog', title: 'Backlog', tasks: ids.map(task) }
}

function boardColumn(column: Column) {
  return (
    <DndContext>
      <BoardColumn
        column={column}
        pendingTaskIds={new Set()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onConfirm={vi.fn()}
        onSaveTitle={vi.fn()}
        onSaveNotes={vi.fn()}
      />
    </DndContext>
  )
}

function renderColumn(column: Column) {
  const view = render(boardColumn(column))
  const list = screen.getByRole('list')
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: LIST_HEIGHT })
  return { list, rerender: view.rerender }
}

function addCard(title: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Add a card to Backlog' }), {
    target: { value: title },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
}

afterEach(cleanup)

describe('BoardColumn scrolling', () => {
  it('scrolls down to a card added with the form', () => {
    const { list, rerender } = renderColumn(backlog(['a']))

    addCard('New card')
    rerender(boardColumn(backlog(['a', 'b'])))

    expect(list.scrollTop).toBe(LIST_HEIGHT)
  })

  it('stays where it is when a card arrives some other way', () => {
    const { list, rerender } = renderColumn(backlog(['a']))

    rerender(boardColumn(backlog(['a', 'b'])))

    expect(list.scrollTop).toBe(0)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import type { Task } from '../board-model'
import { TaskCard } from './TaskCard'

const doneTask: Task = {
  id: 't1',
  title: 'Ship the report',
  notes: '',
  createdAt: 1000,
  movedAt: 2000,
  doneAt: 2000,
}

const onConfirm = vi.fn()

function renderCard(task: Task = doneTask) {
  render(
    <DndContext>
      <SortableContext items={[task.id]}>
        <ul>
          <TaskCard
            task={task}
            columnId={task.doneAt === null ? 'doing' : 'done'}
            isSaving={false}
            onDelete={vi.fn()}
            onConfirm={onConfirm}
            onSaveTitle={vi.fn()}
            onSaveNotes={vi.fn()}
          />
        </ul>
      </SortableContext>
    </DndContext>,
  )
}

const archiveButton = () =>
  screen.queryByRole('button', { name: 'Move Ship the report to history' })

afterEach(() => {
  cleanup()
  onConfirm.mockClear()
})

describe('TaskCard archive button', () => {
  it('shows an icon instead of the word Okay', () => {
    renderCard()

    expect(archiveButton()?.querySelector('svg')).toBeTruthy()
    expect(screen.queryByText('Okay')).toBeNull()
  })

  it('explains itself on hover', () => {
    renderCard()

    expect(archiveButton()?.getAttribute('title')).toBe('Move to history')
  })

  it('moves the card to the history when pressed', () => {
    renderCard()

    fireEvent.click(archiveButton() as HTMLElement)

    expect(onConfirm).toHaveBeenCalledWith('t1')
  })

  it('is only on cards that are done', () => {
    renderCard({ ...doneTask, doneAt: null })

    expect(archiveButton()).toBeNull()
  })
})

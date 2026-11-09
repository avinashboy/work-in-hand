import { useEffect, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Column, ColumnId } from '../board-model'
import { AddTaskForm } from './AddTaskForm'
import { TaskCard } from './TaskCard'

interface BoardColumnProps {
  readonly column: Column
  readonly pendingTaskIds: ReadonlySet<string>
  readonly onCreate: (columnId: ColumnId, title: string) => void
  readonly onDelete: (taskId: string) => void
  readonly onConfirm: (taskId: string) => void
  readonly onSaveTitle: (taskId: string, title: string) => void
  readonly onSaveNotes: (taskId: string, notes: string) => void
}

export function BoardColumn({
  column,
  pendingTaskIds,
  onCreate,
  onDelete,
  onConfirm,
  onSaveTitle,
  onSaveNotes,
}: BoardColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  })
  const headingId = `column-${column.id}`
  const listRef = useRef<HTMLOListElement>(null)
  const shouldRevealNewCard = useRef(false)
  const cardCount = column.tasks.length

  // New cards land at the bottom of the list, which may be scrolled out of view.
  useEffect(() => {
    const list = listRef.current
    if (!shouldRevealNewCard.current || list === null) return
    shouldRevealNewCard.current = false
    list.scrollTop = list.scrollHeight
  }, [cardCount])

  function handleCreate(title: string) {
    shouldRevealNewCard.current = true
    onCreate(column.id, title)
  }

  return (
    <section
      ref={setNodeRef}
      className="column"
      data-column={column.id}
      aria-labelledby={headingId}
    >
      <header className="column-head">
        <h2 id={headingId}>{column.title}</h2>
        <span className="column-count">{column.tasks.length}</span>
      </header>

      <SortableContext
        id={column.id}
        items={column.tasks.map(({ id }) => id)}
        strategy={verticalListSortingStrategy}
      >
        <ol ref={listRef} className="task-list">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isSaving={pendingTaskIds.has(task.id)}
              onDelete={onDelete}
              onConfirm={onConfirm}
              onSaveTitle={onSaveTitle}
              onSaveNotes={onSaveNotes}
            />
          ))}
          {column.tasks.length === 0 ? (
            <li className="task-empty">Nothing here yet</li>
          ) : null}
        </ol>
      </SortableContext>

      <AddTaskForm
        columnTitle={column.title}
        onSubmit={handleCreate}
      />
    </section>
  )
}

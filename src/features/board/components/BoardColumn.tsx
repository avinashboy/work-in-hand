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
  readonly onSaveNotes: (taskId: string, notes: string) => void
}

export function BoardColumn({
  column,
  pendingTaskIds,
  onCreate,
  onDelete,
  onConfirm,
  onSaveNotes,
}: BoardColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: 'column' },
  })
  const headingId = `column-${column.id}`

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
        <ol className="task-list">
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isSaving={pendingTaskIds.has(task.id)}
              onDelete={onDelete}
              onConfirm={onConfirm}
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
        onSubmit={(title) => onCreate(column.id, title)}
      />
    </section>
  )
}

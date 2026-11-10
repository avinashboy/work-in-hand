import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  type Announcements,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { LogoutButton } from '../../auth/components/LogoutButton'
import { DemoBanner } from '../../demo/components/DemoBanner'
import { IS_DEMO } from '../../demo/demo-config'
import { useDemoVisit } from '../../demo/use-demo-visit'
import {
  createTaskId,
  type Board,
  type BoardCommand,
  type ColumnId,
} from '../board-model'
import {
  useBoardCommand,
  useDemoRoomLeft,
  useOptimisticBoard,
  usePendingTaskIds,
} from '../board-queries'
import { countTasks, resolveDropTarget } from '../board-reducer'
import { boardCollisionDetection, useBoardDrag } from '../use-board-drag'
import { BoardColumn } from './BoardColumn'
import { TaskFace } from './TaskCard'
import { ThemeSwitch } from './ThemeSwitch'

interface Notice {
  readonly id: number
  readonly text: string
}

const FAILURE_MESSAGES: Record<BoardCommand['type'], string> = {
  move: 'That move didn’t save, so the card went back.',
  create: 'That card didn’t save, so it was removed.',
  'set-title': 'That title didn’t save, so the old one is back.',
  'set-notes': 'Those notes didn’t save, so the old ones are back.',
  delete: 'That delete didn’t save, so the card is back.',
  archive: 'That didn’t save, so the card stayed in Done.',
}

function titleOf(board: Board, taskId: string | number): string {
  const task = board.columns
    .flatMap(({ tasks }) => tasks)
    .find(({ id }) => id === taskId)
  return task?.title ?? 'card'
}

function describeLocation(board: Board, overId: UniqueIdentifier): string {
  const target = resolveDropTarget(board, String(overId))
  const column = board.columns.find(({ id }) => id === target?.columnId)
  return target && column
    ? `${column.title}, position ${target.index + 1}`
    : 'no column'
}

function createAnnouncements(board: Board): Announcements {
  return {
    onDragStart: ({ active }) => `Picked up ${titleOf(board, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(board, active.id)} over ${describeLocation(board, over.id)}.`
        : `${titleOf(board, active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${titleOf(board, active.id)} in ${describeLocation(board, over.id)}.`
        : `${titleOf(board, active.id)} went back.`,
    onDragCancel: ({ active }) =>
      `Cancelled. ${titleOf(board, active.id)} went back.`,
  }
}

export function BoardView() {
  const board = useOptimisticBoard()
  const pendingTaskIds = usePendingTaskIds()
  const [notice, setNotice] = useState<Notice | null>(null)
  const send = useBoardCommand({
    onFailure: (command) =>
      setNotice((previous) => ({
        id: (previous?.id ?? 0) + 1,
        text: FAILURE_MESSAGES[command.type],
      })),
  })
  const drag = useBoardDrag(board, send)
  const demoRoomLeft = useDemoRoomLeft()
  useDemoVisit()
  const isBoardFull = demoRoomLeft === 0

  function createTask(columnId: ColumnId, title: string) {
    if (isBoardFull) return
    send({
      type: 'create',
      taskId: createTaskId(),
      columnId,
      title,
      at: Date.now(),
    })
  }

  const totalTasks = countTasks(board)

  return (
    <main className="board-page board-page-fit">
      {IS_DEMO ? <DemoBanner roomLeft={demoRoomLeft} /> : null}
      <header className="masthead">
        <h1>Work in Hand</h1>
        <div className="masthead-meta">
          <p className="tally">
            <strong>{totalTasks}</strong> {totalTasks === 1 ? 'card' : 'cards'}
            <span className="tally-state">
              {pendingTaskIds.size > 0
                ? `Saving ${pendingTaskIds.size}…`
                : 'All saved'}
            </span>
          </p>
          <Link to="/history" className="history-link">
            History
          </Link>
          <ThemeSwitch />
          {IS_DEMO ? null : <LogoutButton />}
        </div>
      </header>

      <DndContext
        id="board-dnd"
        sensors={drag.sensors}
        collisionDetection={boardCollisionDetection}
        accessibility={{ announcements: createAnnouncements(drag.visibleBoard) }}
        onDragStart={drag.handleDragStart}
        onDragOver={drag.handleDragOver}
        onDragEnd={drag.handleDragEnd}
        onDragCancel={drag.handleDragCancel}
      >
        <div className="columns" data-dragging={drag.activeTask !== null}>
          {drag.visibleBoard.columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              pendingTaskIds={pendingTaskIds}
              onCreate={createTask}
              isAddingDisabled={isBoardFull}
              onDelete={(taskId) => send({ type: 'delete', taskId })}
              onConfirm={(taskId) => send({ type: 'archive', taskId })}
              onSaveTitle={(taskId, title) => send({ type: 'set-title', taskId, title })}
              onSaveNotes={(taskId, notes) => send({ type: 'set-notes', taskId, notes })}
            />
          ))}
        </div>
        <DragOverlay>
          {drag.activeTask ? (
            // dnd-kit measures this outer element, so the tilt must stay on the
            // inner one: a rotated box skews keyboard and collision geometry.
            <div className="task-overlay">
              <div className="task task-overlay-card">
                <TaskFace task={drag.activeTask} isSaving={false} />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="notice-region" role="status">
        {notice ? (
          // The key remounts it so a repeated failure is announced again.
          <div className="notice" key={notice.id}>
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}

import { useState } from 'react'
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type ClientRect,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  COLUMN_IDS,
  type Board,
  type BoardCommand,
  type ColumnId,
  type Task,
} from './board-model'
import {
  applyCommand,
  resolveDropTarget,
  type DropTarget,
} from './board-reducer'

const MOUSE_ACTIVATION_DISTANCE_PX = 4
const TOUCH_HOLD_MS = 180
const TOUCH_MOVE_TOLERANCE_PX = 8
const COLUMN_STEP_BY_KEY: Readonly<Record<string, number | undefined>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
}

interface DragSession {
  readonly taskId: string
  readonly origin: DropTarget
  readonly preview: Board
}

/**
 * Picks the column under the pointer first, then the nearest card inside it,
 * so the top of a column means "first" rather than "after everything".
 * Keyboard drags have no pointer and fall back to closestCorners.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const columnHit = pointerWithin(args).find(
    ({ data }) => data?.droppableContainer.data.current?.type === 'column',
  )
  if (!columnHit) return closestCorners(args)

  const cardsInColumn = args.droppableContainers.filter(
    ({ data }) => data.current?.columnId === columnHit.id,
  )
  return cardsInColumn.length > 0
    ? closestCenter({ ...args, droppableContainers: cardsInColumn })
    : [columnHit]
}

/**
 * Left and right step to the neighbouring column, landing on its nearest card.
 * The default getter can't do this: a card's own column starts a few pixels
 * further left than the card, so it counts as "to the left" and traps the drag.
 */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  args,
) => {
  const step = COLUMN_STEP_BY_KEY[event.code]
  if (!step) return sortableKeyboardCoordinates(event, args)

  event.preventDefault()
  const { active, collisionRect, droppableContainers, droppableRects } =
    args.context
  if (!active || !collisionRect) return undefined

  const fromColumn: ColumnId | undefined =
    droppableContainers.get(active.id)?.data.current?.columnId
  if (!fromColumn) return undefined
  const toColumn = COLUMN_IDS[COLUMN_IDS.indexOf(fromColumn) + step]
  if (!toColumn) return undefined

  const cardIds = droppableContainers
    .getEnabled()
    .filter(({ data }) => data.current?.columnId === toColumn)
    .map(({ id }) => id)
  const rects = (cardIds.length > 0 ? cardIds : [toColumn])
    .map((id) => droppableRects.get(id))
    .filter((rect) => rect !== undefined)

  const nearest = rects.reduce<ClientRect | undefined>(
    (best, rect) =>
      !best ||
      Math.abs(rect.top - collisionRect.top) <
        Math.abs(best.top - collisionRect.top)
        ? rect
        : best,
    undefined,
  )
  return nearest && { x: nearest.left, y: nearest.top }
}

function withTaskMovedAcrossColumns(
  session: DragSession,
  overId: string,
): DragSession {
  const target = resolveDropTarget(session.preview, overId)
  const current = resolveDropTarget(session.preview, session.taskId)
  if (!target || target.columnId === current?.columnId) return session

  return {
    ...session,
    preview: applyCommand(session.preview, {
      type: 'move',
      taskId: session.taskId,
      toColumnId: target.columnId,
      toIndex: target.index,
      at: Date.now(),
    }),
  }
}

function findActiveTask(session: DragSession | null): Task | null {
  if (!session) return null
  const tasks = session.preview.columns.flatMap((column) => column.tasks)
  return tasks.find(({ id }) => id === session.taskId) ?? null
}

export function useBoardDrag(
  board: Board,
  send: (command: BoardCommand) => void,
) {
  const [session, setSession] = useState<DragSession | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_HOLD_MS,
        tolerance: TOUCH_MOVE_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: boardKeyboardCoordinates,
      scrollBehavior: 'auto',
    }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    const taskId = String(active.id)
    const origin = resolveDropTarget(board, taskId)
    if (origin) setSession({ taskId, origin, preview: board })
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) return
    setSession(
      (current) =>
        current && withTaskMovedAcrossColumns(current, String(over.id)),
    )
  }

  function handleDragEnd({ over }: DragEndEvent) {
    if (!session) return
    const target = over
      ? resolveDropTarget(session.preview, String(over.id))
      : null
    const hasMoved =
      target !== null &&
      (target.columnId !== session.origin.columnId ||
        target.index !== session.origin.index)

    // Send before clearing the preview: the command is already pending when
    // React next renders, so the card never flashes back to where it started.
    if (hasMoved) {
      send({
        type: 'move',
        taskId: session.taskId,
        toColumnId: target.columnId,
        toIndex: target.index,
        at: Date.now(),
      })
    }
    setSession(null)
  }

  function handleDragCancel() {
    setSession(null)
    // The card returns to a column the strip may have scrolled away from.
    // Two frames: dnd-kit restores focus to the card in the first one.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.activeElement?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        }),
      ),
    )
  }

  return {
    visibleBoard: session?.preview ?? board,
    activeTask: findActiveTask(session),
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}

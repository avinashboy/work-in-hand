import { describe, expect, it } from 'vitest'
import {
  MAX_NOTES_LENGTH,
  boardCommandSchema,
  createSeedBoard,
  type Board,
} from './board-model'
import { applyCommand } from './board-reducer'

const AT = 1_800_000_000_000

function firstTask(board: Board) {
  return board.columns[0].tasks[0]
}

describe('card notes in the reducer', () => {
  const board = createSeedBoard(AT)

  it('gives new seed cards empty notes', () => {
    expect(firstTask(board).notes).toBe('')
  })

  it('saves notes on the one card', () => {
    const next = applyCommand(board, {
      type: 'set-notes',
      taskId: firstTask(board).id,
      notes: 'A longer description',
    })

    expect(firstTask(next).notes).toBe('A longer description')
    expect(next.columns[0].tasks[1].notes).toBe('')
  })

  it('does not change the original board', () => {
    applyCommand(board, { type: 'set-notes', taskId: firstTask(board).id, notes: 'x' })

    expect(firstTask(board).notes).toBe('')
  })

  it('does not count as moving the card', () => {
    const next = applyCommand(board, {
      type: 'set-notes',
      taskId: firstTask(board).id,
      notes: 'x',
    })

    expect(firstTask(next).movedAt).toBe(firstTask(board).movedAt)
  })

  it('ignores notes for a card that is gone', () => {
    expect(applyCommand(board, { type: 'set-notes', taskId: 'gone', notes: 'x' })).toBe(board)
  })

  it('creates a card with notes', () => {
    const next = applyCommand(board, {
      type: 'create',
      taskId: 'new-card',
      columnId: 'doing',
      title: 'New',
      notes: 'From the start',
      at: AT,
    })

    expect(next.columns[1].tasks.at(-1)?.notes).toBe('From the start')
  })

  it('creates a card with empty notes when none are given', () => {
    const next = applyCommand(board, {
      type: 'create',
      taskId: 'new-card',
      columnId: 'doing',
      title: 'New',
      at: AT,
    })

    expect(next.columns[1].tasks.at(-1)?.notes).toBe('')
  })
})

describe('notes validation', () => {
  const command = (notes: string) => ({ type: 'set-notes', taskId: 'card-1', notes })

  it('accepts notes up to the limit, including empty ones', () => {
    expect(boardCommandSchema.safeParse(command('')).success).toBe(true)
    expect(
      boardCommandSchema.safeParse(command('x'.repeat(MAX_NOTES_LENGTH))).success,
    ).toBe(true)
  })

  it('refuses notes over the limit', () => {
    expect(
      boardCommandSchema.safeParse(command('x'.repeat(MAX_NOTES_LENGTH + 1))).success,
    ).toBe(false)
  })
})

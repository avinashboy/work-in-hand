import { describe, expect, it } from 'vitest'
import {
  MAX_TITLE_LENGTH,
  boardCommandSchema,
  createSeedBoard,
  type Board,
} from './board-model'
import { applyCommand } from './board-reducer'

const AT = 1_800_000_000_000

function firstTask(board: Board) {
  return board.columns[0].tasks[0]
}

describe('renaming a card in the reducer', () => {
  const board = createSeedBoard(AT)
  const rename = (title: string) =>
    applyCommand(board, { type: 'set-title', taskId: firstTask(board).id, title })

  it('changes only that card’s title', () => {
    const next = rename('A better name')

    expect(firstTask(next).title).toBe('A better name')
    expect(next.columns[0].tasks[1].title).toBe(board.columns[0].tasks[1].title)
  })

  it('does not change the original board', () => {
    const before = firstTask(board).title

    rename('Another name')

    expect(firstTask(board).title).toBe(before)
  })

  it('does not count as moving the card', () => {
    expect(firstTask(rename('New')).movedAt).toBe(firstTask(board).movedAt)
  })

  it('keeps the card’s notes', () => {
    const withNotes = applyCommand(board, {
      type: 'set-notes',
      taskId: firstTask(board).id,
      notes: 'Keep me',
    })

    const next = applyCommand(withNotes, {
      type: 'set-title',
      taskId: firstTask(board).id,
      title: 'New',
    })

    expect(firstTask(next).notes).toBe('Keep me')
  })

  it('ignores a card that is gone', () => {
    expect(applyCommand(board, { type: 'set-title', taskId: 'gone', title: 'x' })).toBe(board)
  })
})

describe('title validation', () => {
  const command = (title: string) => ({ type: 'set-title', taskId: 'card-1', title })

  it('trims spaces around the title', () => {
    expect(boardCommandSchema.parse(command('  Tidy  '))).toMatchObject({ title: 'Tidy' })
  })

  it('refuses a blank title', () => {
    expect(boardCommandSchema.safeParse(command('   ')).success).toBe(false)
  })

  it('accepts a title at the limit and refuses a longer one', () => {
    expect(boardCommandSchema.safeParse(command('x'.repeat(MAX_TITLE_LENGTH))).success).toBe(true)
    expect(boardCommandSchema.safeParse(command('x'.repeat(MAX_TITLE_LENGTH + 1))).success).toBe(
      false,
    )
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('../demo/demo-config', () => ({ IS_DEMO: true }))

const { boardCommandSchema, taskNotesSchema, taskTitleSchema } = await import('./board-model')

describe('card text on the demo', () => {
  it('refuses a title with HTML in it', () => {
    expect(taskTitleSchema.safeParse('<script>alert(1)</script>').success).toBe(false)
  })

  it('refuses notes with HTML in them', () => {
    expect(taskNotesSchema.safeParse('<img src=x onerror=alert(1)>').success).toBe(false)
  })

  it('allows everyday text, including the word alert', () => {
    expect(taskTitleSchema.safeParse('hello, alert! Call at 10:30 (urgent)').success).toBe(true)
    expect(taskNotesSchema.safeParse('Line one\nLine two: $5 & 10%').success).toBe(true)
  })

  it('makes the server refuse a command carrying an attack', () => {
    const command = {
      type: 'create',
      taskId: 'abc123',
      columnId: 'backlog',
      title: '"><svg onload=alert(1)>',
      at: 1,
    }

    expect(boardCommandSchema.safeParse(command).success).toBe(false)
    expect(boardCommandSchema.safeParse({ ...command, title: 'Safe title' }).success).toBe(true)
  })

  it('makes the server refuse a notes change carrying an attack', () => {
    const command = { type: 'set-notes', taskId: 'abc123', notes: '`${alert(1)}`' }

    expect(boardCommandSchema.safeParse(command).success).toBe(false)
    expect(boardCommandSchema.safeParse({ ...command, notes: 'Safe notes' }).success).toBe(true)
  })
})

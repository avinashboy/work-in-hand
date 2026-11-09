import { describe, expect, it } from 'vitest'
import type { ArchivedTask } from './board-model'
import { buildTimeline } from './board-timeline'

const CREATED = 1000

const task: ArchivedTask = {
  id: 't1',
  title: 'Task',
  createdAt: CREATED,
  doneAt: 4000,
  archivedAt: 5000,
  reason: 'confirmed',
  moves: [
    { columnId: 'backlog', at: CREATED },
    { columnId: 'doing', at: 2000 },
    { columnId: 'review', at: 3000 },
    { columnId: 'done', at: 4000 },
  ],
}

describe('buildTimeline', () => {
  it('lists every stage in order, from started to history', () => {
    const { steps } = buildTimeline(task)

    expect(steps.map(({ label, at }) => [label, at])).toEqual([
      ['Started in backlog', 1000],
      ['Moved to in progress', 2000],
      ['Moved to in review', 3000],
      ['Done', 4000],
      ['Moved to history', 5000],
    ])
  })

  it('says how the card reached the history', () => {
    const expired = buildTimeline({ ...task, reason: 'expired' })

    expect(buildTimeline(task).steps.at(-1)?.detail).toBe('Archive pressed')
    expect(expired.steps.at(-1)?.detail).toBe('After 24 hours')
  })

  it('gives each stage the tone of its column', () => {
    expect(buildTimeline(task).steps.map(({ tone }) => tone)).toEqual([
      'backlog',
      'doing',
      'review',
      'done',
      'history',
    ])
  })

  it('shows a card going back as its own step', () => {
    const { steps } = buildTimeline({
      ...task,
      moves: [
        { columnId: 'backlog', at: CREATED },
        { columnId: 'review', at: 2000 },
        { columnId: 'doing', at: 2500 },
        { columnId: 'done', at: 4000 },
      ],
    })

    expect(steps.map(({ label }) => label)).toEqual([
      'Started in backlog',
      'Moved to in review',
      'Moved to in progress',
      'Done',
      'Moved to history',
    ])
  })

  it('is complete when every move was recorded', () => {
    expect(buildTimeline(task).isPartial).toBe(false)
  })

  it('admits when earlier moves were not recorded', () => {
    const timeline = buildTimeline({
      ...task,
      moves: [{ columnId: 'done', at: 4000 }],
    })

    expect(timeline.isPartial).toBe(true)
    expect(timeline.steps.map(({ label }) => label)).toEqual([
      'Started',
      'Done',
      'Moved to history',
    ])
  })

  it('still works with no recorded moves at all', () => {
    const timeline = buildTimeline({ ...task, moves: [] })

    expect(timeline.isPartial).toBe(true)
    expect(timeline.steps.map(({ at }) => at)).toEqual([1000, 5000])
  })
})

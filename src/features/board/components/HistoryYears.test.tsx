import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ArchivedTask } from '../board-model'
import { HistoryYears } from './HistoryYears'

function card(id: string, title: string, iso: string): ArchivedTask {
  const archivedAt = Date.parse(iso)
  return {
    id,
    title,
    notes: '',
    createdAt: archivedAt - 3_000_000,
    doneAt: archivedAt - 1_000_000,
    archivedAt,
    reason: 'confirmed',
    archivedBy: { kind: 'board', client: null },
    moves: [],
    edits: [],
  }
}

// Mid-year times, so the year is the same in every time zone.
const tasks = [
  card('a', 'Plan the newsletter', '2026-06-15T12:00:00Z'),
  card('b', 'Fix the login loop', '2026-03-15T12:00:00Z'),
  card('c', 'Review the contract', '2025-07-15T12:00:00Z'),
  card('d', 'Register the domain', '2022-05-15T12:00:00Z'),
]

afterEach(() => {
  cleanup()
})

function renderYears() {
  render(
    <table>
      <HistoryYears tasks={tasks} deletingTaskId={null} onDelete={vi.fn()} />
    </table>,
  )
}

describe('HistoryYears', () => {
  it('puts a heading above each year, newest first', () => {
    renderYears()

    const headings = screen.getAllByRole('rowheader').filter((cell) => /^\d{4}$/.test(cell.textContent ?? ''))
    expect(headings.map((cell) => cell.textContent)).toEqual(['2026', '2025', '2022'])
  })

  it('keeps each card under its own year', () => {
    renderYears()

    const groups = screen.getAllByRole('rowgroup')
    expect(within(groups[0]).getByText('2026')).toBeTruthy()
    expect(within(groups[0]).getByRole('button', { name: 'Plan the newsletter' })).toBeTruthy()
    expect(within(groups[0]).getByRole('button', { name: 'Fix the login loop' })).toBeTruthy()
    expect(within(groups[1]).getByRole('button', { name: 'Review the contract' })).toBeTruthy()
    expect(within(groups[2]).getByRole('button', { name: 'Register the domain' })).toBeTruthy()
  })

  it('labels each year section for screen readers', () => {
    renderYears()

    expect(screen.getByRole('rowgroup', { name: 'Moved to History in 2025' })).toBeTruthy()
  })

  it('puts a month heading above each month’s cards, inside its year', () => {
    renderYears()

    const groups = screen.getAllByRole('rowgroup')
    const rowsIn2026 = within(groups[0])
      .getAllByRole('row')
      .map((row) => row.textContent ?? '')
    const june = rowsIn2026.findIndex((text) => text === 'June')
    const march = rowsIn2026.findIndex((text) => text === 'March')

    expect(june).toBeGreaterThan(0)
    expect(rowsIn2026[june + 1]).toContain('Plan the newsletter')
    expect(march).toBeGreaterThan(june + 1)
    expect(rowsIn2026[march + 1]).toContain('Fix the login loop')
    expect(within(groups[2]).getByText('May')).toBeTruthy()
  })

  it('names the month and year for screen readers', () => {
    renderYears()

    expect(screen.getByLabelText('June 2026')).toBeTruthy()
  })
})

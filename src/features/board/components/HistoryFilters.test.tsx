import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NO_HISTORY_FILTER, type HistoryFilter } from '../history-filter'
import { HistoryFilters } from './HistoryFilters'

function renderFilters(filter: HistoryFilter = NO_HISTORY_FILTER) {
  const onApply = vi.fn()
  render(<HistoryFilters filter={filter} onApply={onApply} />)
  return onApply
}

const titleBox = () => screen.getByRole('searchbox', { name: 'Title' })
const rangeBox = () => screen.getByRole('combobox', { name: 'Moved to History' })
const searchButton = () => screen.getByRole('button', { name: 'Search' })

afterEach(() => {
  cleanup()
})

describe('HistoryFilters', () => {
  it('searches by title', () => {
    const onApply = renderFilters()

    fireEvent.change(titleBox(), { target: { value: 'invoice' } })
    fireEvent.click(searchButton())

    expect(onApply).toHaveBeenCalledWith({ ...NO_HISTORY_FILTER, search: 'invoice' })
  })

  it('applies a preset range as soon as it is picked, keeping the typed words', () => {
    const onApply = renderFilters()

    fireEvent.change(titleBox(), { target: { value: 'review' } })
    fireEvent.change(rangeBox(), { target: { value: '6m' } })

    expect(onApply).toHaveBeenCalledWith({ ...NO_HISTORY_FILTER, search: 'review', range: '6m' })
  })

  it('offers every range', () => {
    renderFilters()

    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual([
      'Any time',
      'Last 7 days',
      'Last 30 days',
      'Last 3 months',
      'Last 6 months',
      'Last 12 months',
      'Custom range',
    ])
  })

  it('shows start and end boxes for a custom range, and waits for Search', () => {
    const onApply = renderFilters()

    fireEvent.change(rangeBox(), { target: { value: 'custom' } })
    expect(onApply).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01T09:00' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-31T18:30' } })
    fireEvent.click(searchButton())

    expect(onApply).toHaveBeenCalledWith({
      search: '',
      range: 'custom',
      from: new Date(2026, 0, 1, 9, 0).getTime(),
      // The whole end minute counts, up to 18:30:59.999.
      to: new Date(2026, 2, 31, 18, 30).getTime() + 59_999,
    })
  })

  it('hides the custom boxes for other ranges', () => {
    renderFilters({ ...NO_HISTORY_FILTER, range: '3m' })

    expect(screen.queryByLabelText('From')).toBeNull()
  })

  it('offers Clear only while something is filtered', () => {
    renderFilters()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
    cleanup()

    const onApply = renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice' })
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onApply).toHaveBeenCalledWith(NO_HISTORY_FILTER)
  })

  it('starts from the filter in the address', () => {
    renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice', range: '12m' })

    expect(titleBox()).toHaveProperty('value', 'invoice')
    expect(rangeBox()).toHaveProperty('value', '12m')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NO_HISTORY_FILTER, type HistoryFilter } from '../history-filter'
import { HistoryFilters, TYPING_PAUSE_MS } from './HistoryFilters'

// Cards saved mid-year in 2026 and 2024, so the year is the same in every time zone.
const YEAR_SPANS = [
  { first: Date.UTC(2026, 5, 1), last: Date.UTC(2026, 6, 1) },
  { first: Date.UTC(2024, 5, 1), last: Date.UTC(2024, 6, 1) },
]

function renderFilters(filter: HistoryFilter = NO_HISTORY_FILTER) {
  const onApply = vi.fn()
  render(<HistoryFilters filter={filter} yearSpans={YEAR_SPANS} onApply={onApply} />)
  return onApply
}

const titleBox = () => screen.getByRole('searchbox', { name: 'Title' })
const rangeBox = () => screen.getByRole('combobox', { name: 'Moved to History' })
const searchButton = () => screen.getByRole('button', { name: 'Search' })

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
      'Year or month',
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

  it('offers only the years that have cards', () => {
    renderFilters({
      search: '',
      range: 'period',
      from: new Date(2026, 0, 1).getTime(),
      to: new Date(2027, 0, 1).getTime() - 1,
    })

    const year = screen.getByRole('combobox', { name: 'Year' })
    expect([...year.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['2026', '2024'])
  })

  it('shows the newest year with cards at once when Year or month is picked', () => {
    const onApply = renderFilters()
    const thisYear = 2026

    fireEvent.change(rangeBox(), { target: { value: 'period' } })

    expect(onApply).toHaveBeenCalledWith({
      search: '',
      range: 'period',
      from: new Date(thisYear, 0, 1).getTime(),
      to: new Date(thisYear + 1, 0, 1).getTime() - 1,
    })
    expect(screen.getByRole('combobox', { name: 'Year' })).toHaveProperty('value', String(thisYear))
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveProperty('value', 'all')
  })

  it('narrows to one month of a chosen year, keeping the typed words', () => {
    const onApply = renderFilters({
      search: '',
      range: 'period',
      from: new Date(2026, 0, 1).getTime(),
      to: new Date(2027, 0, 1).getTime() - 1,
    })

    fireEvent.change(titleBox(), { target: { value: 'invoice' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Year' }), { target: { value: '2024' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Month' }), { target: { value: '10' } })

    expect(onApply).toHaveBeenLastCalledWith({
      search: 'invoice',
      range: 'period',
      from: new Date(2024, 10, 1).getTime(),
      to: new Date(2024, 11, 1).getTime() - 1,
    })
  })

  it('offers the whole year and all twelve months', () => {
    renderFilters({
      search: '',
      range: 'period',
      from: new Date(2026, 10, 1).getTime(),
      to: new Date(2026, 11, 1).getTime() - 1,
    })

    const month = screen.getByRole('combobox', { name: 'Month' })
    const names = [...month.querySelectorAll('option')].map((option) => option.textContent)
    expect(names).toEqual([
      'Whole year',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ])
    expect(month).toHaveProperty('value', '10')
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

  it('searches by itself once typing pauses, without pressing Search', () => {
    vi.useFakeTimers()
    const novemberFilter: HistoryFilter = {
      search: '',
      range: 'period',
      from: new Date(2026, 10, 1).getTime(),
      to: new Date(2026, 11, 1).getTime() - 1,
    }
    const onApply = renderFilters(novemberFilter)

    fireEvent.change(titleBox(), { target: { value: 'inv' } })
    fireEvent.change(titleBox(), { target: { value: 'invoice' } })
    vi.advanceTimersByTime(TYPING_PAUSE_MS - 1)
    expect(onApply).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({ ...novemberFilter, search: 'invoice' }, { replace: true })
  })

  it('shows everything again once the title box is emptied', () => {
    vi.useFakeTimers()
    const onApply = renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice' })

    fireEvent.change(titleBox(), { target: { value: '' } })
    vi.advanceTimersByTime(TYPING_PAUSE_MS)

    expect(onApply).toHaveBeenCalledWith(NO_HISTORY_FILTER, { replace: true })
  })

  it('does not search again when only spaces were added', () => {
    vi.useFakeTimers()
    const onApply = renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice' })

    fireEvent.change(titleBox(), { target: { value: 'invoice  ' } })
    vi.advanceTimersByTime(TYPING_PAUSE_MS)

    expect(onApply).not.toHaveBeenCalled()
  })

  it('searches at once on Search, without a second search after the pause', () => {
    vi.useFakeTimers()
    const onApply = renderFilters()

    fireEvent.change(titleBox(), { target: { value: 'invoice' } })
    fireEvent.click(searchButton())
    vi.advanceTimersByTime(TYPING_PAUSE_MS)

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledWith({ ...NO_HISTORY_FILTER, search: 'invoice' })
  })

  it('keeps what is being typed when an earlier search comes back', () => {
    vi.useFakeTimers()
    const view = render(<HistoryFilters filter={NO_HISTORY_FILTER} onApply={vi.fn()} />)

    fireEvent.change(titleBox(), { target: { value: 'invoice' } })
    vi.advanceTimersByTime(TYPING_PAUSE_MS)
    fireEvent.change(titleBox(), { target: { value: 'invoice re' } })
    view.rerender(<HistoryFilters filter={{ ...NO_HISTORY_FILTER, search: 'invoice' }} onApply={vi.fn()} />)

    expect(titleBox()).toHaveProperty('value', 'invoice re')
  })

  it('shows the words from the address after Back', () => {
    const view = render(
      <HistoryFilters filter={{ ...NO_HISTORY_FILTER, search: 'invoice' }} onApply={vi.fn()} />,
    )

    view.rerender(<HistoryFilters filter={{ ...NO_HISTORY_FILTER, search: 'login' }} onApply={vi.fn()} />)

    expect(titleBox()).toHaveProperty('value', 'login')
  })

  it('empties the title box on Clear', () => {
    renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(titleBox()).toHaveProperty('value', '')
  })

  it('starts from the filter in the address', () => {
    renderFilters({ ...NO_HISTORY_FILTER, search: 'invoice', range: '12m' })

    expect(titleBox()).toHaveProperty('value', 'invoice')
    expect(rangeBox()).toHaveProperty('value', '12m')
  })
})

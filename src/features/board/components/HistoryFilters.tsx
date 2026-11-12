import { useState, type FormEvent } from 'react'
import {
  HISTORY_RANGES,
  HISTORY_RANGE_LABELS,
  MAX_HISTORY_SEARCH_LENGTH,
  NO_HISTORY_FILTER,
  isHistoryFiltered,
  type HistoryFilter,
  type HistoryRange,
} from '../history-filter'
import { fromLocalInputValue, toLocalInputValue } from '../history-search'
import type { YearSpan } from '../board-model'
import {
  historyYears,
  periodBounds,
  periodFromBounds,
  yearsWithCards,
  type HistoryPeriod,
} from '../history-period'
import { localYear, monthName, utcYear } from '../history-years'
import { useHasHydrated } from '../use-has-hydrated'
import { useTitleSearch, type ApplyFilter } from './use-title-search'

export { TYPING_PAUSE_MS } from './use-title-search'

interface HistoryFiltersProps {
  readonly filter: HistoryFilter
  /** Which years have cards in History; see YearSpan. */
  readonly yearSpans?: readonly YearSpan[]
  readonly onApply: ApplyFilter
}

function isRange(value: string): value is HistoryRange {
  return HISTORY_RANGES.some((range) => range === value)
}

// The boxes stop at minutes, so an end of 18:30 means up to 18:30:59.999.
const REST_OF_MINUTE_MS = 59_999

function endOfMinute(time: number | null): number | null {
  return time === null ? null : time + REST_OF_MINUTE_MS
}

const WHOLE_YEAR = 'all'
const MONTHS = Array.from({ length: 12 }, (_, month) => month)

/** The Year and Month boxes, or the whole newest year when they aren't on the page yet. */
function readPeriod(data: FormData, newestYear: number): HistoryPeriod {
  const year = Number(data.get('year'))
  const month = data.get('month')
  return {
    year: Number.isInteger(year) && year > 0 ? year : newestYear,
    month: month === null || month === WHOLE_YEAR ? null : Number(month),
  }
}

function readBounds(
  data: FormData,
  range: HistoryRange,
  newestYear: number,
): Pick<HistoryFilter, 'from' | 'to'> {
  if (range === 'period') return periodBounds(readPeriod(data, newestYear))
  if (range !== 'custom') return { from: null, to: null }
  const text = (name: string) => String(data.get(name) ?? '')
  return {
    from: fromLocalInputValue(text('from')),
    to: endOfMinute(fromLocalInputValue(text('to'))),
  }
}

function readForm(form: HTMLFormElement, range: HistoryRange, newestYear: number): HistoryFilter {
  const data = new FormData(form)
  return {
    search: String(data.get('q') ?? '').trim(),
    range,
    ...readBounds(data, range, newestYear),
  }
}

interface PeriodPickerProps {
  readonly filter: HistoryFilter
  readonly cardYears: readonly number[]
  readonly newestYear: number
  readonly onPick: (form: HTMLFormElement | null) => void
}

/** A year with cards, and optionally one month of it. Each change applies at once. */
function PeriodPicker({ filter, cardYears, newestYear, onPick }: PeriodPickerProps) {
  const hasHydrated = useHasHydrated()
  const period = periodFromBounds(filter.from, filter.to)
  const year = period?.year ?? newestYear
  const month = period?.month ?? null

  // Like the custom boxes, these are remounted once the viewer's time zone is known.
  return (
    <div className="history-custom-range" key={hasHydrated ? 'local' : 'server'}>
      <label className="history-field">
        <span>Year</span>
        <select name="year" defaultValue={year} onChange={(event) => onPick(event.currentTarget.form)}>
          {historyYears(cardYears, newestYear, year).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="history-field">
        <span>Month</span>
        <select
          name="month"
          defaultValue={month ?? WHOLE_YEAR}
          onChange={(event) => onPick(event.currentTarget.form)}
        >
          <option value={WHOLE_YEAR}>Whole year</option>
          {MONTHS.map((option) => (
            <option key={option} value={option}>
              {monthName(option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function CustomRange({ filter }: { readonly filter: HistoryFilter }) {
  const hasHydrated = useHasHydrated()
  const local = (time: number | null) => (hasHydrated && time !== null ? toLocalInputValue(time) : '')

  // The server can't know the viewer's time zone, so the boxes are remounted
  // with local times once hydrated.
  return (
    <div className="history-custom-range" key={hasHydrated ? 'local' : 'server'}>
      <label className="history-field">
        <span>From</span>
        <input type="datetime-local" name="from" defaultValue={local(filter.from)} />
      </label>
      <label className="history-field">
        <span>To</span>
        <input type="datetime-local" name="to" defaultValue={local(filter.to)} />
      </label>
    </div>
  )
}

/**
 * Title words and a date range for History. Words search by themselves as
 * you type; presets and Year or month apply at once; custom dates on Search.
 */
export function HistoryFilters({ filter, yearSpans = [], onApply }: HistoryFiltersProps) {
  const [range, setRange] = useState<HistoryRange>(filter.range)
  const title = useTitleSearch(filter, onApply)
  // Years follow the viewer's time zone, like History's year headings.
  const cardYears = yearsWithCards(yearSpans, useHasHydrated() ? localYear : utcYear)
  const newestYear = cardYears[0] ?? new Date().getFullYear()

  const applyForm = (form: HTMLFormElement, nextRange: HistoryRange) => {
    const next = readForm(form, nextRange, newestYear)
    title.settle(next.search)
    onApply(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    applyForm(event.currentTarget, range)
  }

  const pickRange = (value: string, form: HTMLFormElement | null) => {
    if (!isRange(value)) return
    setRange(value)
    if (value !== 'custom' && form) applyForm(form, value)
  }

  const clear = () => {
    title.clear()
    onApply(NO_HISTORY_FILTER)
  }

  return (
    <form className="history-filters" role="search" aria-label="Search History" onSubmit={submit}>
      <label className="history-field history-field-title">
        <span>Title</span>
        <input
          type="search"
          name="q"
          value={title.text}
          onChange={(event) => title.type(event.currentTarget.value)}
          maxLength={MAX_HISTORY_SEARCH_LENGTH}
          placeholder="Words in the title"
        />
      </label>
      <label className="history-field">
        <span>Moved to History</span>
        <select
          name="range"
          value={range}
          onChange={(event) => pickRange(event.currentTarget.value, event.currentTarget.form)}
        >
          {HISTORY_RANGES.map((id) => (
            <option key={id} value={id}>
              {HISTORY_RANGE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      {range === 'custom' ? <CustomRange filter={filter} /> : null}
      {range === 'period' ? (
        <PeriodPicker
          filter={filter}
          cardYears={cardYears}
          newestYear={newestYear}
          onPick={(form) => form && applyForm(form, 'period')}
        />
      ) : null}
      <div className="history-filter-actions">
        <button type="submit" className="history-search-button">
          Search
        </button>
        {isHistoryFiltered(filter) ? (
          <button type="button" className="history-clear" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>
    </form>
  )
}

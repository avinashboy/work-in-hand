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
import { useHasHydrated } from '../use-has-hydrated'

interface HistoryFiltersProps {
  readonly filter: HistoryFilter
  readonly onApply: (filter: HistoryFilter) => void
}

function isRange(value: string): value is HistoryRange {
  return HISTORY_RANGES.some((range) => range === value)
}

// The boxes stop at minutes, so an end of 18:30 means up to 18:30:59.999.
const REST_OF_MINUTE_MS = 59_999

function endOfMinute(time: number | null): number | null {
  return time === null ? null : time + REST_OF_MINUTE_MS
}

function readForm(form: HTMLFormElement, range: HistoryRange): HistoryFilter {
  const data = new FormData(form)
  const text = (name: string) => String(data.get(name) ?? '')
  const isCustom = range === 'custom'
  return {
    search: text('q').trim(),
    range,
    from: isCustom ? fromLocalInputValue(text('from')) : null,
    to: isCustom ? endOfMinute(fromLocalInputValue(text('to'))) : null,
  }
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

/** Title words and a date range for History. Presets apply at once; words and custom dates on Search. */
export function HistoryFilters({ filter, onApply }: HistoryFiltersProps) {
  const [range, setRange] = useState<HistoryRange>(filter.range)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApply(readForm(event.currentTarget, range))
  }

  const pickRange = (value: string, form: HTMLFormElement | null) => {
    if (!isRange(value)) return
    setRange(value)
    if (value !== 'custom' && form) onApply(readForm(form, value))
  }

  return (
    <form className="history-filters" role="search" aria-label="Search History" onSubmit={submit}>
      <label className="history-field history-field-title">
        <span>Title</span>
        <input
          type="search"
          name="q"
          defaultValue={filter.search}
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
      <div className="history-filter-actions">
        <button type="submit" className="history-search-button">
          Search
        </button>
        {isHistoryFiltered(filter) ? (
          <button type="button" className="history-clear" onClick={() => onApply(NO_HISTORY_FILTER)}>
            Clear
          </button>
        ) : null}
      </div>
    </form>
  )
}

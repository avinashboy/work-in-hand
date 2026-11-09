const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
// Stored times come from the server, whose clock can run a little ahead.
const CLOCK_DRIFT_MS = 5 * SECOND_MS

const UNITS = [
  { unit: 'day', size: DAY_MS },
  { unit: 'hour', size: HOUR_MS },
  { unit: 'minute', size: MINUTE_MS },
] as const

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

/** Counts whole units, so 119 seconds is "1 minute ago". */
export function formatRelativeTime(value: number, now: number): string {
  const elapsed = now - value
  if (elapsed > -CLOCK_DRIFT_MS && elapsed < SECOND_MS) return 'just now'

  const { unit, size } = UNITS.find(
    (candidate) => Math.abs(elapsed) >= candidate.size,
  ) ?? { unit: 'second', size: SECOND_MS }
  return relativeFormat.format(-Math.trunc(elapsed / size), unit)
}

/** Leave timeZone out to use the viewer's own locale and time zone. */
export function formatTimestamp(value: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(timeZone ? 'en-GB' : undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(value)
}

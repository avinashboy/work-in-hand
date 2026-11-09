import { describe, expect, it } from 'vitest'
import { formatRelativeTime, formatTimestamp } from './board-time'

const NOW = Date.UTC(2026, 10, 9, 12)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it.each([
    [SECOND, '1 second ago'],
    [42 * SECOND, '42 seconds ago'],
    [MINUTE, '1 minute ago'],
    [3 * MINUTE, '3 minutes ago'],
    [HOUR, '1 hour ago'],
    [2 * HOUR, '2 hours ago'],
    [DAY, '1 day ago'],
    [12 * DAY, '12 days ago'],
  ])('describes %i ms in the past', (elapsed, expected) => {
    expect(formatRelativeTime(NOW - elapsed, NOW)).toBe(expected)
  })

  it('counts whole units only, never rounding up', () => {
    expect(formatRelativeTime(NOW - (2 * MINUTE - 1), NOW)).toBe('1 minute ago')
  })

  it('says just now for the first second', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now')
    expect(formatRelativeTime(NOW - 999, NOW)).toBe('just now')
  })

  it('says just now when the server clock is slightly ahead', () => {
    expect(formatRelativeTime(NOW + 3 * SECOND, NOW)).toBe('just now')
  })

  it('describes a time in the future', () => {
    expect(formatRelativeTime(NOW + 23 * HOUR, NOW)).toBe('in 23 hours')
    expect(formatRelativeTime(NOW + 10 * MINUTE, NOW)).toBe('in 10 minutes')
  })
})

describe('formatTimestamp', () => {
  it('shows the date and time in the requested zone', () => {
    const text = formatTimestamp(Date.UTC(2026, 10, 9, 14, 5), 'UTC')

    expect(text).toContain('9 Nov 2026')
    expect(text).toContain('14:05')
  })
})

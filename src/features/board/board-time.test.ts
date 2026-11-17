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
  it('shows a short date and a 12-hour time in the requested zone', () => {
    expect(formatTimestamp(Date.UTC(2026, 10, 9, 14, 5), 'UTC')).toBe('09-Nov-26, 02:05 PM')
  })

  it('pads the hour and says AM in the morning', () => {
    expect(formatTimestamp(Date.UTC(2026, 10, 17, 7, 44), 'UTC')).toBe('17-Nov-26, 07:44 AM')
  })

  it('shows midnight and noon as 12', () => {
    expect(formatTimestamp(Date.UTC(2026, 0, 1, 0, 0), 'UTC')).toBe('01-Jan-26, 12:00 AM')
    expect(formatTimestamp(Date.UTC(2026, 0, 1, 12, 0), 'UTC')).toBe('01-Jan-26, 12:00 PM')
  })
})

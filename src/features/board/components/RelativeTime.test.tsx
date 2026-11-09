import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { RelativeTime } from './RelativeTime'

const NOW = Date.UTC(2026, 10, 9, 12)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('RelativeTime', () => {
  it('shows how long ago the time was', () => {
    render(<RelativeTime value={NOW - 3 * 60_000} />)

    expect(screen.getByText('3 minutes ago')).toBeTruthy()
  })

  it('keeps counting without a reload', () => {
    render(<RelativeTime value={NOW - 58_000} />)
    expect(screen.getByText('58 seconds ago')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('59 seconds ago')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('1 minute ago')).toBeTruthy()
  })

  it('marks up the exact moment for assistive technology', () => {
    const { container } = render(<RelativeTime value={NOW - 5000} />)

    expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
      new Date(NOW - 5000).toISOString(),
    )
  })

  it('stops its timer once nothing is showing a time', () => {
    const { unmount } = render(<RelativeTime value={NOW} />)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('shares one timer between every card', () => {
    render(
      <>
        <RelativeTime value={NOW - 1000} />
        <RelativeTime value={NOW - 2000} />
        <RelativeTime value={NOW - 3000} />
      </>,
    )

    expect(vi.getTimerCount()).toBe(1)
  })

  it('renders no time on the server, whose clock would not match', () => {
    const html = renderToString(<RelativeTime value={NOW - 5000} />)

    expect(html).not.toContain('5 seconds ago')
    expect(html).toContain('data-pending')
  })
})

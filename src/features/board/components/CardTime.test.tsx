import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CardTime } from './CardTime'

const NOW = Date.UTC(2026, 10, 9, 12)
const THIRTEEN_MINUTES_AGO = NOW - 13 * 60_000

function renderTime() {
  const view = render(
    <>
      <CardTime label="Added" value={THIRTEEN_MINUTES_AGO} />
      <p>Elsewhere</p>
    </>,
  )
  return {
    trigger: screen.getByRole('button', { name: '13 minutes ago' }),
    line: view.container.querySelector('.task-time'),
  }
}

function tap(element: Element) {
  fireEvent.pointerDown(element, { pointerType: 'touch' })
  fireEvent.click(element)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CardTime', () => {
  it('shows the label and the relative time', () => {
    const { line } = renderTime()

    expect(line?.textContent).toContain('Added')
    expect(line?.textContent).toContain('13 minutes ago')
  })

  it('links the relative time to the exact time for screen readers', () => {
    const { trigger } = renderTime()

    const tip = document.getElementById(trigger.getAttribute('aria-describedby') ?? '')

    expect(tip?.getAttribute('role')).toBe('tooltip')
    expect(tip?.querySelector('time')?.getAttribute('datetime')).toBe(
      new Date(THIRTEEN_MINUTES_AGO).toISOString(),
    )
  })

  it('is closed until something opens it', () => {
    const { line } = renderTime()

    expect(line?.getAttribute('data-open')).toBe('false')
  })

  it('opens when touched', () => {
    const { trigger, line } = renderTime()

    tap(trigger)

    expect(line?.getAttribute('data-open')).toBe('true')
  })

  it('closes on a second touch', () => {
    const { trigger, line } = renderTime()

    tap(trigger)
    tap(trigger)

    expect(line?.getAttribute('data-open')).toBe('false')
  })

  it('closes when the screen is touched anywhere else', () => {
    const { trigger, line } = renderTime()
    tap(trigger)

    fireEvent.pointerDown(screen.getByText('Elsewhere'), { pointerType: 'touch' })

    expect(line?.getAttribute('data-open')).toBe('false')
  })

  it('leaves a mouse click to hover, so nothing stays stuck open', () => {
    const { trigger, line } = renderTime()

    fireEvent.pointerDown(trigger, { pointerType: 'mouse' })
    fireEvent.click(trigger)

    expect(line?.getAttribute('data-open')).toBe('false')
  })

  it('stays open while the relative time keeps counting', () => {
    const { trigger, line } = renderTime()
    tap(trigger)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(line?.textContent).toContain('14 minutes ago')
    expect(line?.getAttribute('data-open')).toBe('true')
  })
})

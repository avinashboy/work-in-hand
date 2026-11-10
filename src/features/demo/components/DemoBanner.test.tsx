import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DemoBanner } from './DemoBanner'

afterEach(cleanup)

describe('DemoBanner', () => {
  it('says how many cards are left', () => {
    render(<DemoBanner roomLeft={3} />)

    expect(screen.getByText(/3 cards left\./)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('uses the singular for the last card', () => {
    render(<DemoBanner roomLeft={1} />)

    expect(screen.getByText(/1 card left\./)).toBeTruthy()
  })

  it('says the board is full and adding is turned off', () => {
    render(<DemoBanner roomLeft={0} />)

    const status = screen.getByRole('status')
    expect(status.textContent).toContain('The board is full.')
    expect(status.textContent).toContain('All 9 cards are in use')
    expect(status.textContent).toContain('turns back on by itself')
  })

  it('says nothing about room while the count is loading', () => {
    render(<DemoBanner roomLeft={null} />)

    expect(screen.queryByText(/left\./)).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('')
  })
})

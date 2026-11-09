import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LogoutButton } from './LogoutButton'

describe('LogoutButton', () => {
  afterEach(cleanup)

  it('logs out with a POST, so a link elsewhere cannot trigger it', () => {
    const { container } = render(<LogoutButton />)
    const form = container.querySelector('form')

    expect(form?.getAttribute('method')).toBe('post')
    expect(form?.getAttribute('action')).toBe('/api/logout')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy()
  })
})

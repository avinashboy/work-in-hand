import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginView } from './LoginView'

vi.mock('../../board/components/ThemeSwitch', () => ({
  ThemeSwitch: () => null,
}))

describe('LoginView', () => {
  afterEach(cleanup)

  it('posts the password to the server as a plain form', () => {
    const { container } = render(<LoginView />)
    const form = container.querySelector('form')

    expect(form?.getAttribute('method')).toBe('post')
    expect(form?.getAttribute('action')).toBe('/api/login')
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password')
  })

  it('shows no message before the first try', () => {
    render(<LoginView />)

    expect(screen.getByRole('alert').textContent).toBe('')
  })

  it.each([
    ['invalid', /isn.t right/],
    ['locked', /Too many tries/],
    ['setup', /No password has been set/],
    ['unavailable', /Try again/],
  ] as const)('explains the %s error', (error, message) => {
    render(<LoginView error={error} />)

    expect(screen.getByRole('alert').textContent).toMatch(message)
  })
})

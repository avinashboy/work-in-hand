import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { NotFoundView } from './NotFoundView'

async function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: Outlet,
    notFoundComponent: NotFoundView,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Page not found' })
}

beforeEach(() => {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

afterEach(cleanup)

describe('NotFoundView', () => {
  it('shows the 404 code and the address that was not found', async () => {
    await renderAt('/no/such/page')

    expect(screen.getByText('404')).toBeTruthy()
    expect(screen.getByText('/no/such/page')).toBeTruthy()
  })

  it('links back to the board and the history', async () => {
    await renderAt('/missing')

    const board = screen.getByRole('link', { name: 'Back to the board' })
    const history = screen.getByRole('link', { name: 'History' })

    expect(board.getAttribute('href')).toBe('/')
    expect(history.getAttribute('href')).toBe('/history')
  })

  it('offers the light and dark switch', async () => {
    await renderAt('/missing')

    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy()
  })
})

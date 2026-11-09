import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { useDeleteArchivedTask } from './board-queries'

const { deleteCalls } = vi.hoisted(() => ({ deleteCalls: [] as string[] }))

vi.mock('./board-api', () => ({
  deleteArchivedTask: ({ data }: { data: string }) => {
    deleteCalls.push(data)
    return data === 'fails'
      ? Promise.reject(new Error('Server said no'))
      : Promise.resolve()
  },
}))

const ARCHIVE_PAGE_KEY = ['board-archive', 1]

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  client.setQueryData(ARCHIVE_PAGE_KEY, { tasks: [] })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, ...renderHook(() => useDeleteArchivedTask(), { wrapper }) }
}

describe('useDeleteArchivedTask', () => {
  it('asks the server to delete the card', async () => {
    const { result } = setup()

    act(() => result.current.mutate('t1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(deleteCalls).toContain('t1')
  })

  it('reloads the history afterwards', async () => {
    const { client, result } = setup()

    act(() => result.current.mutate('t1'))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(ARCHIVE_PAGE_KEY)?.isInvalidated).toBe(true)
  })

  it('reports a failure and leaves the history alone', async () => {
    const { client, result } = setup()

    act(() => result.current.mutate('fails'))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryState(ARCHIVE_PAGE_KEY)?.isInvalidated).toBe(false)
  })
})

import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardCommand, BoardSnapshot } from './board-model'
import { useBoardCommand, useDemoRoomLeft } from './board-queries'

const { server } = vi.hoisted(() => ({
  server: {
    cardCount: 0,
    boardCalls: 0,
    pending: [] as ((board: BoardSnapshot) => void)[],
  },
}))

function snapshot(demoCardCount: number): BoardSnapshot {
  return { columns: [], demoCardCount }
}

vi.mock('../demo/demo-config', () => ({ IS_DEMO: true, DEMO_MAX_CARDS: 9 }))

vi.mock('./board-api', () => ({
  getBoard: () => {
    server.boardCalls += 1
    return Promise.resolve(snapshot(server.cardCount))
  },
  applyBoardCommand: () =>
    new Promise<BoardSnapshot>((resolve) => {
      server.pending.push(resolve)
    }),
}))

const create: BoardCommand = { type: 'create', taskId: 'new', columnId: 'backlog', title: 'New', at: 1 }

function setUp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => ({ roomLeft: useDemoRoomLeft(), send: useBoardCommand({ onFailure: vi.fn() }) }),
    { wrapper },
  )
}

beforeEach(() => {
  server.cardCount = 0
  server.boardCalls = 0
  server.pending = []
})

describe('useDemoRoomLeft', () => {
  it('is the cap minus the cards the server counts', async () => {
    server.cardCount = 6
    const { result } = setUp()

    await waitFor(() => expect(result.current.roomLeft).toBe(3))
  })

  it('is zero once the demo is full', async () => {
    server.cardCount = 9
    const { result } = setUp()

    await waitFor(() => expect(result.current.roomLeft).toBe(0))
  })

  it('counts a card that is still being saved', async () => {
    server.cardCount = 8
    const { result } = setUp()
    await waitFor(() => expect(result.current.roomLeft).toBe(1))

    act(() => result.current.send(create))

    await waitFor(() => expect(result.current.roomLeft).toBe(0))
  })

  it('takes the new count from the save’s reply, with no extra request', async () => {
    server.cardCount = 8
    const { result } = setUp()
    await waitFor(() => expect(result.current.roomLeft).toBe(1))
    act(() => result.current.send(create))
    await waitFor(() => expect(server.pending).toHaveLength(1))
    const callsBefore = server.boardCalls

    await act(async () => server.pending[0](snapshot(9)))

    expect(result.current.roomLeft).toBe(0)
    expect(server.boardCalls).toBe(callsBefore)
  })
})

import { useState, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board, BoardCommand } from './board-model'
import {
  boardQueryOptions,
  useBoardCommand,
  useOptimisticBoard,
  usePendingTaskIds,
} from './board-queries'

interface Deferred {
  readonly command: BoardCommand
  readonly resolve: (board: Board) => void
  readonly reject: (error: Error) => void
}

const { serverCalls, initialBoard } = vi.hoisted(() => {
  const board: Board = {
    columns: [
      { id: 'backlog', title: 'Backlog', tasks: [{ id: 'a', title: 'A', createdAt: 1000, movedAt: 1000, doneAt: null }] },
      { id: 'doing', title: 'Doing', tasks: [{ id: 'b', title: 'B', createdAt: 1000, movedAt: 1000, doneAt: null }] },
      { id: 'review', title: 'Review', tasks: [] },
      { id: 'done', title: 'Done', tasks: [] },
    ],
  }
  return { serverCalls: [] as Deferred[], initialBoard: board }
})

vi.mock('./board-api', () => ({
  getBoard: () => Promise.resolve(initialBoard),
  applyBoardCommand: ({ data }: { data: BoardCommand }) =>
    new Promise<Board>((resolve, reject) => {
      serverCalls.push({ command: data, resolve, reject })
    }),
}))

vi.mock('./simulated-network', () => ({
  simulateNetwork: () => Promise.resolve(),
}))

const moveA: BoardCommand = {
  type: 'move',
  taskId: 'a',
  toColumnId: 'review',
  toIndex: 0,
  at: 1000,
}

const moveB: BoardCommand = {
  type: 'move',
  taskId: 'b',
  toColumnId: 'done',
  toIndex: 0,
  at: 1000,
}

function boardAfterMoveA(): Board {
  return {
    columns: [
      { id: 'backlog', title: 'Backlog', tasks: [] },
      { id: 'doing', title: 'Doing', tasks: [{ id: 'b', title: 'B', createdAt: 1000, movedAt: 1000, doneAt: null }] },
      { id: 'review', title: 'Review', tasks: [{ id: 'a', title: 'A', createdAt: 1000, movedAt: 1000, doneAt: null }] },
      { id: 'done', title: 'Done', tasks: [] },
    ],
  }
}

function columnOf(board: Board, taskId: string): string | undefined {
  return board.columns.find(({ tasks }) =>
    tasks.some(({ id }) => id === taskId),
  )?.id
}

function setup(onFailure = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  })
  queryClient.setQueryData(boardQueryOptions.queryKey, initialBoard)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const { result } = renderHook(
    () => ({
      board: useOptimisticBoard(),
      pendingTaskIds: usePendingTaskIds(),
      send: useBoardCommand({ simulateOutage: false, onFailure }),
      rerender: useState(0)[1],
    }),
    { wrapper },
  )

  return { result, onFailure, queryClient }
}

async function nextServerCall(position: number): Promise<Deferred> {
  await waitFor(() => expect(serverCalls.length).toBe(position + 1))
  return serverCalls[position]
}

describe('optimistic board', () => {
  beforeEach(() => {
    serverCalls.length = 0
  })

  it('shows a move before the server has answered', async () => {
    const { result } = setup()

    act(() => result.current.send(moveA))

    await waitFor(() => {
      expect(columnOf(result.current.board, 'a')).toBe('review')
    })
    expect(result.current.pendingTaskIds.has('a')).toBe(true)
  })

  it('is visible to a render batched with the send, so drops never flicker', () => {
    const { result } = setup()

    act(() => {
      result.current.send(moveA)
      result.current.rerender(1)
    })

    expect(columnOf(result.current.board, 'a')).toBe('review')
  })

  it('keeps the move and clears pending once the server confirms', async () => {
    const { result } = setup()

    act(() => result.current.send(moveA))
    const call = await nextServerCall(0)
    await act(async () => call.resolve(boardAfterMoveA()))

    await waitFor(() => {
      expect(result.current.pendingTaskIds.size).toBe(0)
    })
    expect(columnOf(result.current.board, 'a')).toBe('review')
  })

  it('puts the task back and reports when the save fails', async () => {
    const { result, onFailure } = setup()

    act(() => result.current.send(moveA))
    const call = await nextServerCall(0)
    await act(async () => call.reject(new Error('nope')))

    await waitFor(() => {
      expect(columnOf(result.current.board, 'a')).toBe('backlog')
    })
    expect(onFailure).toHaveBeenCalledWith(moveA)
  })

  it('sends overlapping commands to the server one at a time', async () => {
    const { result } = setup()

    act(() => {
      result.current.send(moveA)
      result.current.send(moveB)
    })
    const first = await nextServerCall(0)

    expect(serverCalls).toHaveLength(1)
    expect(first.command).toEqual(moveA)

    await act(async () => first.resolve(boardAfterMoveA()))
    const second = await nextServerCall(1)

    expect(second.command).toEqual(moveB)
  })

  it('keeps a later move when an earlier one fails', async () => {
    const { result } = setup()

    act(() => {
      result.current.send(moveA)
      result.current.send(moveB)
    })
    const first = await nextServerCall(0)
    await act(async () => first.reject(new Error('nope')))

    await waitFor(() => {
      expect(columnOf(result.current.board, 'a')).toBe('backlog')
    })
    expect(columnOf(result.current.board, 'b')).toBe('done')
  })
})

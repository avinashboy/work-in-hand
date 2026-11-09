import { useMemo } from 'react'
import {
  queryOptions,
  useMutation,
  useMutationState,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  applyBoardCommand,
  deleteArchivedTask,
  getArchive,
  getBoard,
} from './board-api'
import type { Board, BoardCommand } from './board-model'
import { applyCommand } from './board-reducer'

const BOARD_QUERY_KEY = ['board'] as const
const BOARD_COMMAND_KEY = ['board-command'] as const
const ARCHIVE_QUERY_KEY = ['board-archive'] as const
const BOARD_REFRESH_MS = 60_000

export const boardQueryOptions = queryOptions({
  queryKey: BOARD_QUERY_KEY,
  queryFn: () => getBoard(),
  // Lets an open board notice cards reaching their 24-hour archive time.
  refetchInterval: BOARD_REFRESH_MS,
})

export function archiveQueryOptions(page: number) {
  return queryOptions({
    queryKey: [...ARCHIVE_QUERY_KEY, page],
    queryFn: () => getArchive({ data: page }),
    staleTime: 0,
  })
}

/** Stays pending until the refreshed list has arrived, so nothing flickers. */
export function useDeleteArchivedTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => deleteArchivedTask({ data: taskId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEY }),
  })
}

interface BoardCommandOptions {
  readonly onFailure: (command: BoardCommand) => void
}

/**
 * Saves board commands one at a time, in the order they were made. The cache
 * only ever holds what the server confirmed: see useOptimisticBoard for how
 * unsaved commands reach the screen.
 */
export function useBoardCommand({
  onFailure,
}: BoardCommandOptions): (command: BoardCommand) => void {
  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationKey: BOARD_COMMAND_KEY,
    scope: { id: 'board' },
    mutationFn: (command: BoardCommand): Promise<Board> =>
      applyBoardCommand({ data: command }),
    onMutate: () => queryClient.cancelQueries({ queryKey: BOARD_QUERY_KEY }),
    onSuccess: async (board) => {
      // A refetch that began before this save would overwrite it with old data.
      await queryClient.cancelQueries({ queryKey: BOARD_QUERY_KEY })
      queryClient.setQueryData(BOARD_QUERY_KEY, board)
      void queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEY })
    },
    onError: (_error, command) => {
      onFailure(command)
      const isLastSave =
        queryClient.isMutating({ mutationKey: BOARD_COMMAND_KEY }) === 1
      if (isLastSave) {
        void queryClient.invalidateQueries({ queryKey: BOARD_QUERY_KEY })
      }
    },
  })

  return mutate
}

function usePendingCommands(): readonly BoardCommand[] {
  return useMutationState({
    filters: { mutationKey: BOARD_COMMAND_KEY, status: 'pending' },
    select: (mutation) => mutation.state.variables as BoardCommand,
  })
}

/**
 * The confirmed board with every unsaved command replayed on top. A failed
 * command stops being pending and simply drops out, so rollback needs no
 * snapshots and can't undo a newer change made while it was in flight.
 */
export function useOptimisticBoard(): Board {
  const { data: confirmedBoard } = useSuspenseQuery(boardQueryOptions)
  const pendingCommands = usePendingCommands()

  return useMemo(
    () => pendingCommands.reduce(applyCommand, confirmedBoard),
    [confirmedBoard, pendingCommands],
  )
}

export function usePendingTaskIds(): ReadonlySet<string> {
  const pendingCommands = usePendingCommands()

  return useMemo(
    () => new Set(pendingCommands.map(({ taskId }) => taskId)),
    [pendingCommands],
  )
}

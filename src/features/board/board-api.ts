import { createServerFn } from '@tanstack/react-start'
import {
  archivePageSchema,
  boardCommandSchema,
  taskIdSchema,
  type ArchivePage,
  type Board,
} from './board-model'
import { getBoardStore } from './board-store.server'

// Requests only reach these once src/server.ts has checked the login session.
// The return types are stated because RPC wraps them in its own serialised form.
export const getBoard = createServerFn({ method: 'GET' }).handler(
  (): Promise<Board> => getBoardStore().readBoard(),
)

export const applyBoardCommand = createServerFn({ method: 'POST' })
  .validator(boardCommandSchema)
  .handler(({ data }): Promise<Board> => getBoardStore().applyCommand(data))

export const getArchive = createServerFn({ method: 'GET' })
  .validator(archivePageSchema)
  .handler(({ data }): Promise<ArchivePage> => getBoardStore().listArchive(data))

export const deleteArchivedTask = createServerFn({ method: 'POST' })
  .validator(taskIdSchema)
  .handler(({ data }): Promise<void> => getBoardStore().deleteArchived(data))

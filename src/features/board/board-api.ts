import { createServerFn } from '@tanstack/react-start'
import { requireSignedIn } from '../auth/auth-middleware'
import {
  archivePageSchema,
  boardCommandSchema,
  taskIdSchema,
} from './board-model'
import { getBoardRepository } from './board-repository.server'

export const getBoard = createServerFn({ method: 'GET' })
  .middleware([requireSignedIn])
  .handler(() => getBoardRepository().get())

export const applyBoardCommand = createServerFn({ method: 'POST' })
  .middleware([requireSignedIn])
  .validator(boardCommandSchema)
  .handler(({ data }) => getBoardRepository().apply(data))

export const getArchive = createServerFn({ method: 'GET' })
  .middleware([requireSignedIn])
  .validator(archivePageSchema)
  .handler(({ data }) => getBoardRepository().listArchive(data))

export const deleteArchivedTask = createServerFn({ method: 'POST' })
  .middleware([requireSignedIn])
  .validator(taskIdSchema)
  .handler(({ data }) => getBoardRepository().deleteArchived(data))

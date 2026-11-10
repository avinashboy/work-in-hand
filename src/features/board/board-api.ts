import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { IS_DEMO } from '../demo/demo-config'
import { visitorMiddleware } from '../demo/visitor-middleware'
import type { VisitorFingerprint } from '../demo/visitor-model'
import {
  boardCommandSchema,
  taskIdSchema,
  type ArchivePage,
  type BoardSnapshot,
} from './board-model'
import { getBoardStore, type DemoVisitor } from './board-store.server'
import { archiveQuerySchema } from './history-filter'

/** Who sent this request, for the demo's visitor log. The user agent is read here, not trusted from the page. */
function demoVisitor(fingerprint: VisitorFingerprint | null): DemoVisitor {
  return { fingerprint, userAgent: getRequestHeader('user-agent') ?? null }
}

// Requests only reach these once src/server.ts has checked the login session.
// The return types are stated because RPC wraps them in its own serialised form.
export const getBoard = createServerFn({ method: 'GET' }).handler(
  (): Promise<BoardSnapshot> => getBoardStore().readBoard(),
)

export const applyBoardCommand = createServerFn({ method: 'POST' })
  .middleware([visitorMiddleware])
  .validator(boardCommandSchema)
  .handler(
    ({ data, context }): Promise<BoardSnapshot> =>
      getBoardStore().applyCommand(data, demoVisitor(context.visitor)),
  )

export const getArchive = createServerFn({ method: 'GET' })
  .validator(archiveQuerySchema)
  .handler(({ data }): Promise<ArchivePage> => getBoardStore().listArchive(data.page, data.filter, data.pageSize))

export const deleteArchivedTask = createServerFn({ method: 'POST' })
  .middleware([visitorMiddleware])
  .validator(taskIdSchema)
  .handler(
    ({ data, context }): Promise<void> =>
      getBoardStore().deleteArchived(data, demoVisitor(context.visitor)),
  )

/** Demo only: logs that this browser opened the site. Does nothing elsewhere. */
export const recordDemoVisit = createServerFn({ method: 'POST' })
  .middleware([visitorMiddleware])
  .handler(async ({ context }): Promise<void> => {
    // Logged even without a fingerprint, e.g. when the browser blocks it.
    if (!IS_DEMO) return
    await getBoardStore().recordVisit(demoVisitor(context.visitor))
  })

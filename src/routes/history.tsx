import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireSession } from '../features/auth/auth-guards'
import { archivePageSchema } from '../features/board/board-model'
import { archiveQueryOptions } from '../features/board/board-queries'
import { HistoryView } from '../features/board/components/HistoryView'

const historySearchSchema = z.object({
  page: archivePageSchema.optional().catch(undefined),
})

export const Route = createFileRoute('/history')({
  validateSearch: historySearchSchema,
  beforeLoad: requireSession,
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  head: () => ({
    meta: [{ title: 'History' }],
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(archiveQueryOptions(deps.page)),
  component: HistoryPage,
  errorComponent: HistoryLoadError,
})

function HistoryPage() {
  const { page } = Route.useSearch()
  return <HistoryView page={page ?? 1} />
}

function HistoryLoadError() {
  return (
    <main className="board-error">
      <h1>The history couldn't load.</h1>
      <p>Check your connection and refresh the page.</p>
    </main>
  )
}

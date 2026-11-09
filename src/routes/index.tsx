import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { requireSession } from '../features/auth/auth-guards'
import { boardQueryOptions } from '../features/board/board-queries'
import { BoardView } from '../features/board/components/BoardView'

const boardSearchSchema = z.object({
  outage: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  validateSearch: boardSearchSchema,
  beforeLoad: requireSession,
  head: () => ({
    meta: [{ title: 'Work in Hand' }],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(boardQueryOptions),
  component: BoardPage,
  errorComponent: BoardLoadError,
})

function BoardPage() {
  const { outage } = Route.useSearch()
  return <BoardView simulateOutage={outage === true} />
}

function BoardLoadError() {
  return (
    <main className="board-error">
      <h1>The board couldn't load.</h1>
      <p>Check your connection and refresh the page.</p>
    </main>
  )
}

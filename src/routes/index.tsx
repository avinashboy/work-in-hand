import { createFileRoute } from '@tanstack/react-router'
import { boardQueryOptions } from '../features/board/board-queries'
import { BoardView } from '../features/board/components/BoardView'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Work in Hand' }],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(boardQueryOptions),
  component: BoardView,
  errorComponent: BoardLoadError,
})

function BoardLoadError() {
  return (
    <main className="board-error">
      <h1>The board couldn't load.</h1>
      <p>Check your connection and refresh the page.</p>
    </main>
  )
}

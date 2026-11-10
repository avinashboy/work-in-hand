import { createFileRoute } from '@tanstack/react-router'
import { archiveQueryOptions } from '../features/board/board-queries'
import { HistoryView } from '../features/board/components/HistoryView'
import {
  filterFromSearch,
  historySearchSchema,
  pageSizeFromSearch,
} from '../features/board/history-search'

export const Route = createFileRoute('/history')({
  validateSearch: historySearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    pageSize: pageSizeFromSearch(search),
    filter: filterFromSearch(search),
  }),
  head: () => ({
    meta: [{ title: 'History' }],
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(archiveQueryOptions(deps.page, deps.filter, deps.pageSize)),
  component: HistoryPage,
  errorComponent: HistoryLoadError,
})

function HistoryPage() {
  const search = Route.useSearch()
  return (
    <HistoryView
      page={search.page ?? 1}
      pageSize={pageSizeFromSearch(search)}
      filter={filterFromSearch(search)}
    />
  )
}

function HistoryLoadError() {
  return (
    <main className="board-error">
      <h1>The history couldn't load.</h1>
      <p>Check your connection and refresh the page.</p>
    </main>
  )
}

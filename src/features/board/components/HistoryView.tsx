import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogoutButton } from '../../auth/components/LogoutButton'
import { DemoBanner } from '../../demo/components/DemoBanner'
import { IS_DEMO } from '../../demo/demo-config'
import { useDemoVisit } from '../../demo/use-demo-visit'
import { archiveQueryOptions, useDeleteArchivedTask, useDemoRoomLeft } from '../board-queries'
import { isHistoryFiltered, type HistoryFilter } from '../history-filter'
import { searchFromFilter } from '../history-search'
import { ARCHIVE_PAGE_SIZE, ARCHIVE_PAGE_SIZES, type ArchivePageSize } from '../board-model'
import { pageAfterResize } from '../history-pager'
import { HistoryFilters } from './HistoryFilters'
import { HistoryPager } from './HistoryPager'
import { HistoryYears } from './HistoryYears'
import { ThemeSwitch } from './ThemeSwitch'

interface HistoryViewProps {
  readonly page: number
  readonly pageSize: ArchivePageSize
  readonly filter: HistoryFilter
}

/** Left out of the address at the default, so plain links stay short. */
function sizeInAddress(pageSize: ArchivePageSize): { size?: ArchivePageSize } {
  return pageSize === ARCHIVE_PAGE_SIZE ? {} : { size: pageSize }
}

export function HistoryView({ page, pageSize, filter }: HistoryViewProps) {
  const { data } = useSuspenseQuery(archiveQueryOptions(page, filter, pageSize))
  const navigate = useNavigate({ from: '/history' })
  const isFiltered = isHistoryFiltered(filter)
  const applyFilter = (next: HistoryFilter) => {
    void navigate({ search: { ...searchFromFilter(next), ...sizeInAddress(pageSize) } })
  }
  // Keeps the search and lands on the page that still starts with the same card.
  const changePageSize = (next: ArchivePageSize) => {
    const nextPage = pageAfterResize(data.page, data.pageSize, next)
    void navigate({
      search: (previous) => ({
        ...previous,
        size: sizeInAddress(next).size,
        page: nextPage === 1 ? undefined : nextPage,
      }),
    })
  }
  // Shown once there's more than one page's worth, or a bigger size is chosen,
  // so you can always switch back.
  const showsPager = data.total > ARCHIVE_PAGE_SIZES[0] || pageSize !== ARCHIVE_PAGE_SIZE
  const deletion = useDeleteArchivedTask()
  const demoRoomLeft = useDemoRoomLeft()
  useDemoVisit()

  return (
    <main className="board-page">
      {IS_DEMO ? <DemoBanner roomLeft={demoRoomLeft} /> : null}
      <header className="masthead">
        <h1>History</h1>
        <div className="masthead-meta">
          <p className="tally">
            <strong>{data.total}</strong> {isFiltered ? 'found' : 'finished'}
          </p>
          <Link to="/" className="history-link">
            Back to the board
          </Link>
          <ThemeSwitch />
          {IS_DEMO ? null : <LogoutButton />}
        </div>
      </header>

      {/* Keyed on the address, so Clear and Back reset the boxes too. */}
      <HistoryFilters key={JSON.stringify(filter)} filter={filter} onApply={applyFilter} />

      {deletion.isError ? (
        <p className="history-error" role="alert">
          That card couldn't be deleted. Reload the page and try again.
        </p>
      ) : null}

      {data.tasks.length === 0 && isFiltered ? (
        <p className="history-empty">No cards match. Try other words or a wider date range.</p>
      ) : data.tasks.length === 0 ? (
        <p className="history-empty">
          {IS_DEMO
            ? 'Nothing here yet. Press the archive button on a card in Done.'
            : 'Nothing here yet. Press the archive button on a card in Done, or leave it there for 24 hours.'}
        </p>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Added</th>
              <th scope="col">Done</th>
              <th scope="col">Moved here</th>
              <th scope="col">How</th>
              <th scope="col" aria-label="Delete" />
            </tr>
          </thead>
          <HistoryYears
            tasks={data.tasks}
            deletingTaskId={deletion.isPending ? deletion.variables : null}
            onDelete={deletion.mutate}
          />
        </table>
      )}

      {showsPager ? (
        <HistoryPager
          page={data.page}
          pageCount={data.pageCount}
          total={data.total}
          pageSize={data.pageSize}
          onPageSizeChange={changePageSize}
        />
      ) : null}
    </main>
  )
}

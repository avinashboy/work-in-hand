import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LogoutButton } from '../../auth/components/LogoutButton'
import { DemoBanner } from '../../demo/components/DemoBanner'
import { IS_DEMO } from '../../demo/demo-config'
import { archiveQueryOptions, useDeleteArchivedTask } from '../board-queries'
import { HistoryRow } from './HistoryRow'
import { ThemeSwitch } from './ThemeSwitch'

interface HistoryViewProps {
  readonly page: number
}

export function HistoryView({ page }: HistoryViewProps) {
  const { data } = useSuspenseQuery(archiveQueryOptions(page))
  const deletion = useDeleteArchivedTask()

  return (
    <main className="board-page">
      {IS_DEMO ? <DemoBanner /> : null}
      <header className="masthead">
        <h1>History</h1>
        <div className="masthead-meta">
          <p className="tally">
            <strong>{data.total}</strong> finished
          </p>
          <Link to="/" className="history-link">
            Back to the board
          </Link>
          <ThemeSwitch />
          {IS_DEMO ? null : <LogoutButton />}
        </div>
      </header>

      {deletion.isError ? (
        <p className="history-error" role="alert">
          That card couldn't be deleted. Reload the page and try again.
        </p>
      ) : null}

      {data.tasks.length === 0 ? (
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
          <tbody>
            {data.tasks.map((task) => (
              <HistoryRow
                key={task.id}
                task={task}
                isDeleting={deletion.isPending && deletion.variables === task.id}
                onDelete={deletion.mutate}
              />
            ))}
          </tbody>
        </table>
      )}

      {data.pageCount > 1 ? (
        <nav className="history-pager" aria-label="History pages">
          {data.page > 1 ? (
            <Link to="/history" search={{ page: data.page - 1 }}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span>
            Page {data.page} of {data.pageCount}
          </span>
          {data.page < data.pageCount ? (
            <Link to="/history" search={{ page: data.page + 1 }}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  )
}

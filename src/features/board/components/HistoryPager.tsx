import { Link } from '@tanstack/react-router'
import type { ArchivePageSize } from '../board-model'
import { pagerItems, shownRange } from '../history-pager'
import { PageSizeSelect } from './PageSizeSelect'

interface PageLinksProps {
  readonly page: number
  readonly pageCount: number
}

// Each link keeps the rest of the address: the search, dates and page size.
const toPage = (target: number) => (previous: Record<string, unknown>) => ({ ...previous, page: target })

function StepLink({ target, isAvailable, label, rel }: {
  readonly target: number
  readonly isAvailable: boolean
  readonly label: string
  readonly rel: 'prev' | 'next'
}) {
  return isAvailable ? (
    <Link to="/history" search={toPage(target)} className="history-pager-step" rel={rel}>
      {label}
    </Link>
  ) : (
    <span className="history-pager-step" aria-disabled="true">
      {label}
    </span>
  )
}

function PageLinks({ page, pageCount }: PageLinksProps) {
  return (
    <ol className="history-pager-pages">
      <li>
        <StepLink target={page - 1} isAvailable={page > 1} label="← Newer" rel="prev" />
      </li>
      {pagerItems(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <li key={`gap-${index}`} className="history-pager-gap" aria-hidden="true">
            …
          </li>
        ) : (
          <li key={item}>
            <Link
              to="/history"
              search={toPage(item)}
              className="history-pager-number"
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Page ${item}`}
            >
              {item}
            </Link>
          </li>
        ),
      )}
      <li>
        <StepLink target={page + 1} isAvailable={page < pageCount} label="Older →" rel="next" />
      </li>
    </ol>
  )
}

interface HistoryPagerProps extends PageLinksProps {
  readonly total: number
  readonly pageSize: ArchivePageSize
  readonly onPageSizeChange: (pageSize: ArchivePageSize) => void
}

/** "1–20 of 56", the cards-per-page choice, and numbered pages when there's more than one. */
export function HistoryPager({ page, pageCount, total, pageSize, onPageSizeChange }: HistoryPagerProps) {
  const { first, last } = shownRange(page, total, pageSize)

  return (
    <nav className="history-pager" aria-label="History pages">
      <div className="history-pager-info">
        <p className="history-pager-count">
          {first}–{last} of {total}
        </p>
        <PageSizeSelect pageSize={pageSize} onChange={onPageSizeChange} />
      </div>
      {pageCount > 1 ? <PageLinks page={page} pageCount={pageCount} /> : null}
    </nav>
  )
}

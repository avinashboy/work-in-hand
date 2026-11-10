/** Page numbers for History's pager: first, last and the pages around the current one. */

export type PagerItem = number | 'gap'

// First, last, current with one either side, and two gaps.
const SLOTS = 7
const EDGE_RUN = SLOTS - 2 // pages shown together at the start or end: 1 2 3 4 5 … 20

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index)

export function pagerItems(page: number, pageCount: number): readonly PagerItem[] {
  if (pageCount <= SLOTS) return range(1, pageCount)
  if (page <= EDGE_RUN - 1) return [...range(1, EDGE_RUN), 'gap', pageCount]
  if (page >= pageCount - EDGE_RUN + 2) {
    return [1, 'gap', ...range(pageCount - EDGE_RUN + 1, pageCount)]
  }
  return [1, 'gap', page - 1, page, page + 1, 'gap', pageCount]
}

/** The page that still starts with the same card after the page size changes. */
export function pageAfterResize(page: number, oldSize: number, newSize: number): number {
  const firstCard = (page - 1) * oldSize
  return Math.floor(firstCard / newSize) + 1
}

/** "Showing 21–40 of 55": the card numbers on this page. */
export function shownRange(
  page: number,
  total: number,
  pageSize: number,
): { readonly first: number; readonly last: number } {
  if (total === 0) return { first: 0, last: 0 }
  return { first: (page - 1) * pageSize + 1, last: Math.min(page * pageSize, total) }
}

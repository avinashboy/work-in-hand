import { useId } from 'react'
import { ARCHIVE_PAGE_SIZES, type ArchivePageSize } from '../board-model'

interface PageSizeSelectProps {
  readonly pageSize: ArchivePageSize
  readonly onChange: (pageSize: ArchivePageSize) => void
}

function toPageSize(value: string): ArchivePageSize | null {
  return ARCHIVE_PAGE_SIZES.find((size) => String(size) === value) ?? null
}

/** How many History cards to show on a page. */
export function PageSizeSelect({ pageSize, onChange }: PageSizeSelectProps) {
  const id = useId()

  return (
    <div className="history-page-size">
      <label htmlFor={id}>Per page</label>
      <select
        id={id}
        value={pageSize}
        onChange={(event) => {
          const size = toPageSize(event.currentTarget.value)
          if (size !== null) onChange(size)
        }}
      >
        {ARCHIVE_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  )
}

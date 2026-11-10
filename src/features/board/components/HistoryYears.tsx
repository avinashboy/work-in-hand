import { useId } from 'react'
import type { ArchivedTask } from '../board-model'
import { groupByYear, localYear, utcYear, type YearGroup } from '../history-years'
import { useHasHydrated } from '../use-has-hydrated'
import { COLUMN_COUNT, HistoryRow } from './HistoryRow'

interface HistoryYearsProps {
  readonly tasks: readonly ArchivedTask[]
  readonly deletingTaskId: string | null
  readonly onDelete: (taskId: string) => void
}

function YearSection({
  group,
  deletingTaskId,
  onDelete,
}: Omit<HistoryYearsProps, 'tasks'> & { readonly group: YearGroup<ArchivedTask> }) {
  const headingId = useId()

  return (
    <tbody className="history-year-group" aria-labelledby={headingId}>
      <tr className="history-year">
        <th scope="rowgroup" colSpan={COLUMN_COUNT}>
          <span id={headingId} aria-label={`Moved to History in ${group.year}`}>
            {group.year}
          </span>
        </th>
      </tr>
      {group.tasks.map((task) => (
        <HistoryRow
          key={task.id}
          task={task}
          isDeleting={deletingTaskId === task.id}
          onDelete={onDelete}
        />
      ))}
    </tbody>
  )
}

/**
 * History's rows, one section per year. Years follow the viewer's time zone,
 * like the times beside them: UTC until the page has hydrated, then local.
 */
export function HistoryYears({ tasks, deletingTaskId, onDelete }: HistoryYearsProps) {
  const yearOf = useHasHydrated() ? localYear : utcYear

  return groupByYear(tasks, yearOf).map((group) => (
    <YearSection key={group.year} group={group} deletingTaskId={deletingTaskId} onDelete={onDelete} />
  ))
}

import { useId } from 'react'
import type { ArchivedTask } from '../board-model'
import {
  groupByMonth,
  groupByYear,
  localMonth,
  localYear,
  monthName,
  utcMonth,
  utcYear,
  type YearGroup,
} from '../history-years'
import { useHasHydrated } from '../use-has-hydrated'
import { COLUMN_COUNT, HistoryRow } from './HistoryRow'

interface HistoryYearsProps {
  readonly tasks: readonly ArchivedTask[]
  readonly deletingTaskId: string | null
  readonly onDelete: (taskId: string) => void
}

type SectionProps = Omit<HistoryYearsProps, 'tasks'> & {
  readonly group: YearGroup<ArchivedTask>
  readonly monthOf: (time: number) => number
}

function YearSection({ group, monthOf, deletingTaskId, onDelete }: SectionProps) {
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
      {groupByMonth(group.tasks, monthOf).flatMap(({ month, tasks }) => [
        <tr key={`month-${month}`} className="history-month">
          <th scope="colgroup" colSpan={COLUMN_COUNT}>
            <span aria-label={`${monthName(month)} ${group.year}`}>{monthName(month)}</span>
          </th>
        </tr>,
        ...tasks.map((task) => (
          <HistoryRow
            key={task.id}
            task={task}
            isDeleting={deletingTaskId === task.id}
            onDelete={onDelete}
          />
        )),
      ])}
    </tbody>
  )
}

/**
 * History's rows, one section per year with a heading for each month inside it.
 * Years and months follow the viewer's time zone, like the times beside them:
 * UTC until the page has hydrated, then local.
 */
export function HistoryYears({ tasks, deletingTaskId, onDelete }: HistoryYearsProps) {
  const hasHydrated = useHasHydrated()
  const yearOf = hasHydrated ? localYear : utcYear
  const monthOf = hasHydrated ? localMonth : utcMonth

  return groupByYear(tasks, yearOf).map((group) => (
    <YearSection
      key={group.year}
      group={group}
      monthOf={monthOf}
      deletingTaskId={deletingTaskId}
      onDelete={onDelete}
    />
  ))
}

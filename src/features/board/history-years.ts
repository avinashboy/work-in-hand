/** Splits History into years, and each year into months, by when each card moved to History. */

export interface YearGroup<T> {
  readonly year: number
  readonly tasks: readonly T[]
}

export interface MonthGroup<T> {
  /** 0 for January through 11 for December, like Date#getMonth. */
  readonly month: number
  readonly tasks: readonly T[]
}

export const utcYear = (time: number): number => new Date(time).getUTCFullYear()
export const localYear = (time: number): number => new Date(time).getFullYear()
export const utcMonth = (time: number): number => new Date(time).getUTCMonth()
export const localMonth = (time: number): number => new Date(time).getMonth()

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Fixed English names, so the server and the browser always agree. */
export function monthName(month: number): string {
  return MONTH_NAMES[month] ?? ''
}

interface Run<K, T> {
  readonly key: K
  readonly tasks: readonly T[]
}

/** Groups neighbouring cards that share a key, keeping their order. */
function groupRuns<K, T extends { readonly archivedAt: number }>(
  tasks: readonly T[],
  keyOf: (time: number) => K,
): readonly Run<K, T>[] {
  return tasks.reduce<readonly Run<K, T>[]>((runs, task) => {
    const key = keyOf(task.archivedAt)
    const last = runs.at(-1)
    return last?.key === key
      ? [...runs.slice(0, -1), { key, tasks: [...last.tasks, task] }]
      : [...runs, { key, tasks: [task] }]
  }, [])
}

/** Cards arrive newest first, so each year's cards are already next to each other. */
export function groupByYear<T extends { readonly archivedAt: number }>(
  tasks: readonly T[],
  yearOf: (time: number) => number,
): readonly YearGroup<T>[] {
  return groupRuns(tasks, yearOf).map(({ key, tasks: inYear }) => ({ year: key, tasks: inYear }))
}

/** Splits one year's newest-first cards into months; pass only cards from a single year. */
export function groupByMonth<T extends { readonly archivedAt: number }>(
  tasks: readonly T[],
  monthOf: (time: number) => number,
): readonly MonthGroup<T>[] {
  return groupRuns(tasks, monthOf).map(({ key, tasks: inMonth }) => ({ month: key, tasks: inMonth }))
}

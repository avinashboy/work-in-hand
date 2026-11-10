/** Splits History into years, by when each card moved to History. */

export interface YearGroup<T> {
  readonly year: number
  readonly tasks: readonly T[]
}

export const utcYear = (time: number): number => new Date(time).getUTCFullYear()
export const localYear = (time: number): number => new Date(time).getFullYear()

/** Cards arrive newest first, so each year's cards are already next to each other. */
export function groupByYear<T extends { readonly archivedAt: number }>(
  tasks: readonly T[],
  yearOf: (time: number) => number,
): readonly YearGroup<T>[] {
  return tasks.reduce<readonly YearGroup<T>[]>((groups, task) => {
    const year = yearOf(task.archivedAt)
    const last = groups.at(-1)
    return last?.year === year
      ? [...groups.slice(0, -1), { year, tasks: [...last.tasks, task] }]
      : [...groups, { year, tasks: [task] }]
  }, [])
}

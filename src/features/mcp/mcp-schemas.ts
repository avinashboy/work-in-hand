import { z } from 'zod'
import { TASK_SORTS } from '../board/board-task-queries.server'

/**
 * What each MCP tool accepts, as plain JSON shapes an agent can read from
 * tools/list. The values are then checked again by the REST API's own schemas,
 * so both doors into the board apply exactly the same rules.
 */

const MAX_TEXT_INPUT = 10_000

const COLUMN_HELP = 'Backlog, In progress, In review or Done (case does not matter)'
const DATE_HELP = 'A date like 2026-11-09 or 2026-11-09T14:30:00Z'

const taskId = z.string().max(100).describe('The card id, as returned by list_tasks or create_task')
const date = z.string().max(40).describe(DATE_HELP)
const text = z.string().max(MAX_TEXT_INPUT)

export const listTasksInput = z.object({
  status: z
    .enum(['ongoing', 'completed', 'all'])
    .optional()
    .describe('ongoing = not yet done, completed = done. Defaults to all'),
  columns: z.array(z.string().max(40)).max(10).optional().describe(`Only these columns: ${COLUMN_HELP}`),
  archived: z.boolean().optional().describe('true = only cards in History, false = only cards on the board'),
  search: z.string().max(200).optional().describe('Words to find in the title or notes'),
  createdAfter: date.optional(),
  createdBefore: date.optional(),
  doneAfter: date.optional(),
  doneBefore: date.optional(),
  archivedAfter: date.optional().describe(`Moved to History at or after this time. ${DATE_HELP}`),
  archivedBefore: date.optional().describe(`Moved to History before this time. ${DATE_HELP}`),
  year: z
    .number()
    .int()
    .optional()
    .describe(
      'Only cards that moved to History in this year (UTC), such as 2025. Sorted newest first unless sort is given',
    ),
  month: z
    .union([z.number().int(), z.string().max(20)])
    .optional()
    .describe('With year: only that month, as 1 to 12 or a name like "November" or "Nov"'),
  within: z
    .string()
    .max(20)
    .optional()
    .describe(
      'Only cards that moved to History in the last few days, weeks or months, counted back from now: any number, such as "7d", "30d", "2w", "3w", "5m" or "7m". Sorted newest first unless sort is given',
    ),
  sort: z
    .enum(TASK_SORTS)
    .optional()
    .describe('Defaults to createdAt, or archivedAt when year or within is given'),
  order: z.enum(['asc', 'desc']).optional().describe('Defaults to desc, newest first'),
  page: z.number().int().optional().describe('Starts at 1'),
  limit: z.number().int().optional().describe('Cards per page, 1 to 200. Defaults to 50'),
})

export const taskIdInput = z.object({ taskId })

export const createTaskInput = z.object({
  title: text.describe('Short title for the card'),
  notes: text.optional().describe('Longer notes, up to 5,000 characters'),
  column: z
    .string()
    .max(40)
    .optional()
    .describe('Backlog, In progress or In review. Defaults to Backlog'),
})

export const updateTaskInput = z.object({
  taskId,
  title: text.optional().describe('New title'),
  notes: text.optional().describe('New notes. Replaces the old notes; send "" to clear them'),
  column: z.string().max(40).optional().describe(`Move the card to this column: ${COLUMN_HELP}`),
  position: z.number().int().optional().describe('Place in the column, 0 = top'),
})

export type ListTasksInput = z.infer<typeof listTasksInput>
export type CreateTaskInput = z.infer<typeof createTaskInput>
export type UpdateTaskInput = z.infer<typeof updateTaskInput>

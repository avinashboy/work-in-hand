import type { z } from 'zod'
import { taskIdSchema } from '../board/board-model'
import type { TaskChange } from '../board/board-task-queries.server'
import { CHANGE_REFUSALS, NO_SUCH_CARD, toApiTask, toApiTaskDetail } from '../api/task-api-format'
import type { TaskApiStore } from '../api/task-api-routes.server'
import {
  createTaskRequestSchema,
  describeProblem,
  listTasksQuerySchema,
  updateTaskRequestSchema,
} from '../api/task-api-schemas'
import type { CreateTaskInput, ListTasksInput, UpdateTaskInput } from './mcp-schemas'

const UNEXPECTED_ERROR = 'Something went wrong. Try again in a moment.'

export interface BoardToolResult {
  readonly content: readonly [{ readonly type: 'text'; readonly text: string }]
  readonly structuredContent?: Record<string, unknown>
  readonly isError?: true
}

type Run<Input> = (input: Input) => Promise<BoardToolResult>

export interface BoardToolHandlers {
  readonly list_tasks: Run<ListTasksInput>
  readonly get_task: Run<{ readonly taskId: string }>
  readonly get_board_summary: Run<Record<string, never>>
  readonly create_task: Run<CreateTaskInput>
  readonly update_task: Run<UpdateTaskInput>
  readonly archive_task: Run<{ readonly taskId: string }>
  readonly delete_task: Run<{ readonly taskId: string }>
}

/** JSON in `content` for older clients, and the same object as `structuredContent`. */
function ok(data: Record<string, unknown>): BoardToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }
}

function refuse(message: string): BoardToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

/** Runs the API's own schema, so MCP and REST callers meet the same rules. */
function check<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): { readonly data: z.output<Schema> } | { readonly problem: string } {
  const parsed = schema.safeParse(value)
  return parsed.success ? { data: parsed.data } : { problem: describeProblem(parsed.error) }
}

function withoutUndefined<Value extends object>(value: Value): Partial<Value> {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<Value>
}

function respondToChange(change: TaskChange): BoardToolResult {
  return change.outcome === 'changed' ? ok(toApiTaskDetail(change.task)) : refuse(CHANGE_REFUSALS[change.outcome])
}

/** A store failure becomes a plain tool error; the details stay in the Worker log. */
function guarded<Input>(name: string, run: Run<Input>): Run<Input> {
  return async (input) => {
    try {
      return await run(input)
    } catch (error) {
      console.error(`MCP tool ${name} failed:`, error)
      return refuse(UNEXPECTED_ERROR)
    }
  }
}

/** Refuses anything that is not a card id before it reaches the store. */
function withTaskId(name: string, run: (taskId: string) => Promise<BoardToolResult>): Run<{ readonly taskId: string }> {
  return guarded(name, async ({ taskId }) => {
    const parsed = taskIdSchema.safeParse(taskId)
    return parsed.success ? run(parsed.data) : refuse(NO_SUCH_CARD)
  })
}

function toListQuery({ columns, archived, ...rest }: ListTasksInput) {
  return withoutUndefined({
    ...rest,
    column: columns?.join(','),
    archived: archived === undefined ? undefined : String(archived),
  })
}

export function createBoardToolHandlers(store: TaskApiStore): BoardToolHandlers {
  return {
    list_tasks: guarded('list_tasks', async (input) => {
      const query = check(listTasksQuerySchema, toListQuery(input))
      if ('problem' in query) return refuse(query.problem)
      const { tasks, ...meta } = await store.listTasks(query.data)
      return ok({ tasks: tasks.map(toApiTask), meta })
    }),

    get_task: withTaskId('get_task', async (taskId) => {
      const task = await store.findTask(taskId)
      return task ? ok(toApiTaskDetail(task)) : refuse(NO_SUCH_CARD)
    }),

    get_board_summary: guarded('get_board_summary', async () => ok({ ...(await store.summarizeTasks()) })),

    create_task: guarded('create_task', async (input) => {
      const body = check(createTaskRequestSchema, withoutUndefined(input))
      if ('problem' in body) return refuse(body.problem)

      const columnId = body.data.column ?? 'backlog'
      const task = await store.createTask({ title: body.data.title, notes: body.data.notes, columnId })
      if (!task) return refuse('The board is full')
      return ok(toApiTask({ ...task, columnId, archivedAt: null, archiveReason: null }))
    }),

    update_task: guarded('update_task', async ({ taskId, ...fields }) => {
      const id = taskIdSchema.safeParse(taskId)
      if (!id.success) return refuse(NO_SUCH_CARD)
      const patch = check(updateTaskRequestSchema, withoutUndefined(fields))
      if ('problem' in patch) return refuse(patch.problem)
      return respondToChange(await store.updateTask(id.data, patch.data))
    }),

    archive_task: withTaskId('archive_task', async (taskId) => respondToChange(await store.archiveTask(taskId))),

    delete_task: withTaskId('delete_task', async (taskId) =>
      (await store.removeTask(taskId)) ? ok({ id: taskId, deleted: true }) : refuse(NO_SUCH_CARD),
    ),
  }
}

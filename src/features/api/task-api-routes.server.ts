import type { z } from 'zod'
import { taskIdSchema, type ColumnId, type Task } from '../board/board-model'
import type { TaskPatch } from '../board/board-task-operations.server'
import type {
  StoredTaskDetail,
  TaskChange,
  TaskListPage,
  TaskQuery,
  TaskSummary,
} from '../board/board-task-queries.server'
import { isBodyWithinLimit } from '../auth/request-limits'
import { CHANGE_REFUSALS, NO_SUCH_CARD, toApiTask, toApiTaskDetail } from './task-api-format'
import { fail, succeed } from './task-api-response'
import {
  createTaskRequestSchema,
  describeProblem,
  listTasksQuerySchema,
  updateTaskRequestSchema,
} from './task-api-schemas'

const TASKS_PATH = '/api/tasks'
const SUMMARY_PATH = '/api/summary'
const TASK_PATH = /^\/api\/tasks\/([^/]+)(\/archive)?$/

export interface NewApiTask {
  readonly columnId: ColumnId
  readonly title: string
  readonly notes: string
}

export interface TaskApiStore {
  readonly createTask: (input: NewApiTask) => Promise<Task | null>
  readonly listTasks: (query: TaskQuery) => Promise<TaskListPage>
  readonly findTask: (taskId: string) => Promise<StoredTaskDetail | null>
  readonly summarizeTasks: () => Promise<TaskSummary>
  readonly updateTask: (taskId: string, patch: TaskPatch) => Promise<TaskChange>
  readonly removeTask: (taskId: string) => Promise<boolean>
  readonly archiveTask: (taskId: string) => Promise<TaskChange>
}

type Handler = (request: Request) => Promise<Response>
type Routes = Readonly<Record<string, Handler>>

/** Anything under /api/tasks/ answers as the API, so a mistyped path gets JSON, not a login page. */
export function isApiPath(pathname: string): boolean {
  return pathname === TASKS_PATH || pathname === SUMMARY_PATH || pathname.startsWith(`${TASKS_PATH}/`)
}

/** Returns the parsed body, or the refusal to send. */
async function readBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<z.output<Schema> | Response> {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return fail(415, 'Send the body as application/json')
  }
  if (!(await isBodyWithinLimit(request))) return fail(413, 'Request too large')

  const json: unknown = await request.json().catch(() => undefined)
  const parsed = schema.safeParse(json)
  return parsed.success ? parsed.data : fail(400, describeProblem(parsed.error))
}

function respondToChange(change: TaskChange): Response {
  if (change.outcome === 'changed') return succeed(toApiTaskDetail(change.task))
  return fail(change.outcome === 'missing' ? 404 : 409, CHANGE_REFUSALS[change.outcome])
}

function tasksRoutes(store: TaskApiStore): Routes {
  return {
    GET: async (request) => {
      const { searchParams } = new URL(request.url)
      const parsed = listTasksQuerySchema.safeParse(Object.fromEntries(searchParams))
      if (!parsed.success) return fail(400, describeProblem(parsed.error))

      const { tasks, ...meta } = await store.listTasks(parsed.data)
      return succeed(tasks.map(toApiTask), 200, meta)
    },
    POST: async (request) => {
      const body = await readBody(request, createTaskRequestSchema)
      if (body instanceof Response) return body

      const columnId = body.column ?? 'backlog'
      const task = await store.createTask({ title: body.title, notes: body.notes, columnId })
      if (!task) return fail(409, 'The board is full')

      return succeed(toApiTask({ ...task, columnId, archivedAt: null, archiveReason: null }), 201)
    },
  }
}

function taskRoutes(store: TaskApiStore, taskId: string): Routes {
  return {
    GET: async () => {
      const task = await store.findTask(taskId)
      return task ? succeed(toApiTaskDetail(task)) : fail(404, NO_SUCH_CARD)
    },
    PATCH: async (request) => {
      const patch = await readBody(request, updateTaskRequestSchema)
      if (patch instanceof Response) return patch
      return respondToChange(await store.updateTask(taskId, patch))
    },
    DELETE: async () =>
      (await store.removeTask(taskId))
        ? succeed({ id: taskId, deleted: true })
        : fail(404, NO_SUCH_CARD),
  }
}

function routesFor(pathname: string, store: TaskApiStore): Routes | null {
  if (pathname === TASKS_PATH) return tasksRoutes(store)
  if (pathname === SUMMARY_PATH) {
    return { GET: async () => succeed(await store.summarizeTasks()) }
  }

  const match = TASK_PATH.exec(pathname)
  const taskId = taskIdSchema.safeParse(match?.[1])
  if (!match || !taskId.success) return null
  if (match[2] === undefined) return taskRoutes(store, taskId.data)
  return { POST: async () => respondToChange(await store.archiveTask(taskId.data)) }
}

/** Only call this once the API key has been checked. */
export function routeTaskApi(request: Request, store: TaskApiStore): Promise<Response> | Response {
  const routes = routesFor(new URL(request.url).pathname, store)
  if (routes === null) return fail(404, 'No such endpoint')
  if (!Object.hasOwn(routes, request.method)) {
    return fail(405, 'That method is not allowed here', { allow: Object.keys(routes).join(', ') })
  }
  return routes[request.method](request)
}

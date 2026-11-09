import { z } from 'zod'
import { clientKey } from '../auth/auth-gate.server'
import { isSecretCorrect } from '../auth/password-session.server'
import { isBodyWithinLimit } from '../auth/request-limits'
import {
  MAX_NOTES_LENGTH,
  taskTitleSchema,
  type ColumnId,
  type Task,
} from '../board/board-model'

const API_PATH = '/api/tasks'
const MIN_API_KEY_LENGTH = 32
const MAX_API_KEY_LENGTH = 512
const RETRY_AFTER_SECONDS = '60'

const COLUMN_ALIASES: Readonly<Record<string, ColumnId>> = {
  backlog: 'backlog',
  'in progress': 'doing',
  progress: 'doing',
  doing: 'doing',
  'in review': 'review',
  review: 'review',
}
const INVALID_COLUMN = 'column must be Backlog, In progress or In review'

const apiKeyEnvSchema = z.object({ API_KEY: z.string().min(MIN_API_KEY_LENGTH) })

const columnSchema = z
  .string({ error: INVALID_COLUMN })
  .transform((value) => COLUMN_ALIASES[value.trim().toLowerCase().replace(/[\s_-]+/g, ' ')])
  .refine((columnId) => columnId !== undefined, { error: INVALID_COLUMN })

const createTaskRequestSchema = z.object({
  title: taskTitleSchema,
  column: columnSchema.optional(),
  notes: z.string().trim().max(MAX_NOTES_LENGTH).default(''),
})

export interface NewApiTask {
  readonly columnId: ColumnId
  readonly title: string
  readonly notes: string
}

export interface TaskApiOptions {
  /** Null when no usable key is set, which refuses every call. */
  readonly apiKey: string | null
  readonly isWithinRateLimit: (client: string) => Promise<boolean>
  readonly createTask: (input: NewApiTask) => Promise<Task | null>
}

export function isTaskApiRequest(request: Request): boolean {
  return new URL(request.url).pathname === API_PATH
}

export function parseApiKey(env: unknown): string | null {
  const parsed = apiKeyEnvSchema.safeParse(env)
  return parsed.success ? parsed.data.API_KEY : null
}

function respond(
  status: number,
  body: { readonly data: unknown; readonly error: string | null },
  headers: Readonly<Record<string, string>> = {},
): Response {
  return Response.json(
    { success: body.error === null, data: body.data, error: body.error },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...headers,
      },
    },
  )
}

function fail(
  status: number,
  error: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  return respond(status, { data: null, error }, headers)
}

async function hasValidKey(request: Request, apiKey: string): Promise<boolean> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match || match[1].length > MAX_API_KEY_LENGTH) return false
  return isSecretCorrect(match[1], apiKey)
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

function describeProblem(error: z.ZodError): string {
  const [issue] = error.issues
  const field = issue.path.join('.')
  return issue.message === INVALID_COLUMN || !field
    ? issue.message
    : `${field}: ${issue.message}`
}

async function createFromBody(request: Request, options: TaskApiOptions): Promise<Response> {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return fail(415, 'Send the body as application/json')
  }
  if (!(await isBodyWithinLimit(request))) return fail(413, 'Request too large')

  const parsed = createTaskRequestSchema.safeParse(await readJson(request))
  if (!parsed.success) return fail(400, describeProblem(parsed.error))

  const { title, notes, column } = parsed.data
  const columnId = column ?? 'backlog'
  const task = await options.createTask({ title, notes, columnId })
  if (!task) return fail(409, 'The board is full')

  return respond(201, {
    data: {
      id: task.id,
      title: task.title,
      column: columnId,
      notes: task.notes,
      createdAt: new Date(task.createdAt).toISOString(),
    },
    error: null,
  })
}

/** Returns the refusal to send, or null when the request may continue. */
async function refuseIfOverLimit(
  request: Request,
  options: TaskApiOptions,
): Promise<Response | null> {
  try {
    return (await options.isWithinRateLimit(clientKey(request)))
      ? null
      : fail(429, 'Too many requests', { 'retry-after': RETRY_AFTER_SECONDS })
  } catch (error) {
    console.error('Could not check the API rate limit:', error)
    return fail(503, 'The API is unavailable right now')
  }
}

async function processRequest(request: Request, options: TaskApiOptions): Promise<Response> {
  const refusal = await refuseIfOverLimit(request, options)
  if (refusal) return refusal
  if (options.apiKey === null) return fail(503, 'The API is not set up yet')
  if (!(await hasValidKey(request, options.apiKey))) {
    return fail(401, 'Missing or invalid API key', { 'www-authenticate': 'Bearer' })
  }
  return createFromBody(request, options)
}

export async function handleTaskApi(
  request: Request,
  options: TaskApiOptions,
): Promise<Response> {
  if (request.method !== 'POST') return fail(405, 'Use POST', { allow: 'POST' })

  try {
    return await processRequest(request, options)
  } catch (error) {
    console.error('Could not process the API request:', error)
    return fail(500, 'Something went wrong')
  }
}

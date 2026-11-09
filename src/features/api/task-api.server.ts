import { z } from 'zod'
import { clientKey } from '../auth/auth-gate.server'
import { isSecretCorrect } from '../auth/password-session.server'
import { fail } from './task-api-response'
import { isApiPath, routeTaskApi, type TaskApiStore } from './task-api-routes.server'

const MIN_API_KEY_LENGTH = 32
const MAX_API_KEY_LENGTH = 512
const RETRY_AFTER_SECONDS = '60'

const apiKeyEnvSchema = z.object({ API_KEY: z.string().min(MIN_API_KEY_LENGTH) })

export interface TaskApiOptions extends TaskApiStore {
  /** Null when no usable key is set, which refuses every call. */
  readonly apiKey: string | null
  readonly isWithinRateLimit: (client: string) => Promise<boolean>
}

export function isTaskApiRequest(request: Request): boolean {
  return isApiPath(new URL(request.url).pathname)
}

export function parseApiKey(env: unknown): string | null {
  const parsed = apiKeyEnvSchema.safeParse(env)
  return parsed.success ? parsed.data.API_KEY : null
}

async function hasValidKey(request: Request, apiKey: string): Promise<boolean> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match || match[1].length > MAX_API_KEY_LENGTH) return false
  return isSecretCorrect(match[1], apiKey)
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

export async function handleTaskApi(
  request: Request,
  options: TaskApiOptions,
): Promise<Response> {
  try {
    const refusal = await refuseIfOverLimit(request, options)
    if (refusal) return refusal
    if (options.apiKey === null) return fail(503, 'The API is not set up yet')
    if (!(await hasValidKey(request, options.apiKey))) {
      return fail(401, 'Missing or invalid API key', { 'www-authenticate': 'Bearer' })
    }
    return await routeTaskApi(request, options)
  } catch (error) {
    console.error('Could not process the API request:', error)
    return fail(500, 'Something went wrong')
  }
}

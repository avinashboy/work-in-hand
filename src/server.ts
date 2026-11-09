import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { handleTaskApi, isTaskApiRequest, parseApiKey } from './features/api/task-api.server'
import { canSkipLogin, checkRequest } from './features/auth/auth-gate.server'
import { parsePassword } from './features/auth/password-session.server'
import { getLoginAttempts, getTaskApiStore } from './features/board/board-store.server'

export { BoardStore } from './features/board/board-store.server'

export default {
  async fetch(request: Request): Promise<Response> {
    // Checked first: outside apps use an API key instead of the login session.
    if (isTaskApiRequest(request)) {
      return handleTaskApi(request, {
        apiKey: parseApiKey(env),
        isWithinRateLimit: async (client) =>
          (await env.API_RATE_LIMITER.limit({ key: client })).success,
        ...getTaskApiStore(),
      })
    }

    if (canSkipLogin(import.meta.env.DEV, request)) return handler.fetch(request)

    const blocked = await checkRequest(request, {
      password: parsePassword(env),
      attempts: getLoginAttempts(),
      now: Date.now,
    })
    return blocked ?? handler.fetch(request)
  },
}

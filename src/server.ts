import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { handleTaskApi, isTaskApiRequest, parseApiKey } from './features/api/task-api.server'
import { canSkipLogin, checkRequest } from './features/auth/auth-gate.server'
import { parsePassword } from './features/auth/password-session.server'
import { getLoginAttempts, getTaskApiStore } from './features/board/board-store.server'
import { IS_DEMO } from './features/demo/demo-config'
import { checkDemoRequest } from './features/demo/demo-gate.server'

export { BoardStore } from './features/board/board-store.server'

const DEMO_SITE_KEY = 'whole-site'

/** The private site and the demo have different limiters, so each may be absent. */
async function isWithinLimit(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) throw new Error('Rate limiter binding is missing')
  return (await limiter.limit({ key })).success
}

function checkDemoLimits(request: Request): Promise<Response | null> {
  return checkDemoRequest(request, {
    isClientWithinLimit: (client) => isWithinLimit(env.DEMO_CLIENT_LIMITER, client),
    isSiteWithinLimit: () => isWithinLimit(env.DEMO_SITE_LIMITER, DEMO_SITE_KEY),
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (IS_DEMO) return (await checkDemoLimits(request)) ?? handler.fetch(request)

    // Checked first: outside apps use an API key instead of the login session.
    if (isTaskApiRequest(request)) {
      return handleTaskApi(request, {
        apiKey: parseApiKey(env),
        isWithinRateLimit: (client) => isWithinLimit(env.API_RATE_LIMITER, client),
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

import handler from '@tanstack/react-start/server-entry'
import { env } from 'cloudflare:workers'
import { handleTaskApi, isTaskApiRequest, parseApiKey } from './features/api/task-api.server'
import { canSkipLogin, checkRequest } from './features/auth/auth-gate.server'
import { parsePassword } from './features/auth/password-session.server'
import { getBoardStore, getLoginAttempts, getTaskApiStore } from './features/board/board-store.server'
import { IS_DEMO } from './features/demo/demo-config'
import { checkDemoRequest } from './features/demo/demo-gate.server'
import { isMcpRequest } from './features/mcp/mcp-path'

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

function apiAccess() {
  return {
    apiKey: parseApiKey(env),
    isWithinRateLimit: (client: string) => isWithinLimit(env.API_RATE_LIMITER, client),
  }
}

/** Loaded only when an MCP client calls, so ordinary page loads stay lean. */
async function handleMcp(request: Request, context: ExecutionContext): Promise<Response> {
  const { handleMcpRequest } = await import('./features/mcp/mcp-endpoint.server')
  return handleMcpRequest(request, { ...apiAccess(), store: getTaskApiStore() }, context)
}

export default {
  async fetch(request: Request, _env: unknown, context: ExecutionContext): Promise<Response> {
    if (IS_DEMO) return (await checkDemoLimits(request)) ?? handler.fetch(request)

    // Checked first: outside apps and agents use an API key instead of the login session.
    if (isTaskApiRequest(request)) {
      return handleTaskApi(request, { ...apiAccess(), ...getTaskApiStore() })
    }
    if (isMcpRequest(request)) return handleMcp(request, context)

    if (import.meta.env.DEV) {
      const mock = await import('./features/dev/dev-routes.server')
      if (mock.isMockHistoryRequest(request)) {
        const store = getBoardStore()
        return mock.handleMockHistoryRequest(request, {
          add: () => store.changeMockHistory('add'),
          remove: () => store.changeMockHistory('remove'),
        })
      }
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

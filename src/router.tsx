import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createIsomorphicFn, getGlobalStartContext } from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

const QUERY_STALE_TIME_MS = 10_000
const MAX_QUERY_RETRIES = 3

const getScriptNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(() => undefined)

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        retry: MAX_QUERY_RETRIES,
      },
    },
  })
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    context: { queryClient },
    ssr: { nonce: getScriptNonce() },
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

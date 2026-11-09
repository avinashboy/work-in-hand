import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { isBodyWithinLimit } from './features/auth/request-limits'
import { applySecurityHeaders } from './features/auth/request-security.server'

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const HTTP_PAYLOAD_TOO_LARGE = 413

const securityHeaders = createMiddleware().server(({ next }) =>
  next({ context: { nonce: applySecurityHeaders() } }),
)

const crossSiteRequestGuard = createCsrfMiddleware({
  filter: ({ request }) => !READ_ONLY_METHODS.has(request.method),
})

const requestSizeGuard = createMiddleware().server(async ({ request, next }) => {
  if (READ_ONLY_METHODS.has(request.method) || (await isBodyWithinLimit(request))) {
    return next()
  }
  return new Response('Request too large', { status: HTTP_PAYLOAD_TOO_LARGE })
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeaders, crossSiteRequestGuard, requestSizeGuard],
}))

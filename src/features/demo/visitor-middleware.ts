import { createMiddleware } from '@tanstack/react-start'
import { IS_DEMO } from './demo-config'
import { getVisitorFingerprint } from './visitor-fingerprint'
import { parseVisitorFingerprint } from './visitor-model'

/**
 * Sends the demo visitor's fingerprint along with a server function call.
 * The server checks its shape again, since the browser can send anything.
 */
export const visitorMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) =>
    next({ sendContext: { visitor: IS_DEMO ? await getVisitorFingerprint() : null } }),
  )
  .server(({ next, context }) =>
    next({ context: { visitor: IS_DEMO ? parseVisitorFingerprint(context.visitor) : null } }),
  )

import { createMiddleware } from '@tanstack/react-start'
import { assertRequestSignedIn } from './auth-request.server'

/**
 * The real lock: every server function holding private data must use this.
 * Route guards only decide which page to show; this runs on each data request.
 */
export const requireSignedIn = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    assertRequestSignedIn()
    return next()
  },
)

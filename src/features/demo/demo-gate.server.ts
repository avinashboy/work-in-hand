import { clientKey } from '../auth/auth-gate.server'

const HTTP_OK = 200
const HTTP_SEE_OTHER = 303
const HTTP_NOT_FOUND = 404
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_UNAVAILABLE = 503
const RETRY_AFTER_SECONDS = '60'

const COMMON_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export interface DemoGateOptions {
  readonly isClientWithinLimit: (client: string) => Promise<boolean>
  readonly isSiteWithinLimit: () => Promise<boolean>
}

function textResponse(
  status: number,
  body: string,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(body, { status, headers: { ...COMMON_HEADERS, ...headers } })
}

function fixedResponse(pathname: string): Response | null {
  if (pathname.startsWith('/api/')) return textResponse(HTTP_NOT_FOUND, 'Not found')
  if (pathname === '/login') return textResponse(HTTP_SEE_OTHER, '', { location: '/' })
  if (pathname === '/robots.txt') {
    return textResponse(HTTP_OK, 'User-agent: *\nDisallow: /\n')
  }
  return null
}

async function isWithinLimits(request: Request, options: DemoGateOptions): Promise<boolean> {
  // In this order, so one busy visitor can't use up everybody's allowance.
  return (
    (await options.isClientWithinLimit(clientKey(request))) &&
    (await options.isSiteWithinLimit())
  )
}

/**
 * Returns the response to send instead of the app, or null to let it through.
 * The demo has no login or API, and limits every visitor because its free
 * quota is shared with the private site.
 */
export async function checkDemoRequest(
  request: Request,
  options: DemoGateOptions,
): Promise<Response | null> {
  const fixed = fixedResponse(new URL(request.url).pathname)
  if (fixed) return fixed

  try {
    if (await isWithinLimits(request, options)) return null
  } catch (error) {
    console.error('Could not check the demo limits:', error)
    return textResponse(HTTP_UNAVAILABLE, 'The demo is unavailable right now.')
  }
  return textResponse(HTTP_TOO_MANY_REQUESTS, 'Too many requests. Try again in a minute.', {
    'retry-after': RETRY_AFTER_SECONDS,
  })
}

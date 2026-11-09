import { MAX_PASSWORD_LENGTH, type LoginError } from './login-model'
import {
  clearedSessionCookie,
  createSessionCookie,
  isSecretCorrect,
  isSessionValid,
} from './password-session.server'
import { isBodyWithinLimit } from './request-limits'

const LOGIN_PAGE = '/login'
const LOGIN_ENDPOINT = '/api/login'
const LOGOUT_ENDPOINT = '/api/logout'
const IPV6_GROUPS = 8
const IPV6_NETWORK_GROUPS = 4

const HTTP_SEE_OTHER = 303
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_PAYLOAD_TOO_LARGE = 413

export interface LoginAttemptStore {
  readonly reserve: (client: string) => Promise<boolean>
  readonly clear: (client: string) => Promise<void>
}

export interface AuthGateOptions {
  /** Null when no usable password is set, which keeps everyone out. */
  readonly password: string | null
  readonly attempts: LoginAttemptStore
  readonly now: () => number
}

const COMMON_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

/** The hostname check keeps a mistaken development-mode deploy from opening the site. */
export function canSkipLogin(isDevelopmentBuild: boolean, request: Request): boolean {
  return isDevelopmentBuild && new URL(request.url).hostname === 'localhost'
}

function redirect(location: string, setCookie?: string): Response {
  return new Response(null, {
    status: HTTP_SEE_OTHER,
    headers: {
      ...COMMON_HEADERS,
      location,
      ...(setCookie ? { 'set-cookie': setCookie } : {}),
    },
  })
}

function refuse(status: number, message: string): Response {
  return new Response(message, { status, headers: COMMON_HEADERS })
}

function loginFailed(error: LoginError): Response {
  return redirect(`${LOGIN_PAGE}?error=${error}`)
}

function isSameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}

/** One home or phone connection owns a whole IPv6 /64, so that is the unit to count. */
function ipv6Network(ip: string): string {
  const [head, tail = ''] = ip.split('::')
  const start = head.split(':').filter(Boolean)
  const end = tail.split(':').filter(Boolean)
  const zeros = Array.from(
    { length: Math.max(0, IPV6_GROUPS - start.length - end.length) },
    () => '0',
  )
  return [...start, ...zeros, ...end].slice(0, IPV6_NETWORK_GROUPS).join(':')
}

export function clientKey(request: Request): string {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
  return ip.includes(':') ? ipv6Network(ip) : ip
}

async function readSubmittedPassword(request: Request): Promise<string | null> {
  try {
    const value = (await request.formData()).get('password')
    return typeof value === 'string' && value.length <= MAX_PASSWORD_LENGTH ? value : null
  } catch {
    return null
  }
}

async function verifyLogin(
  request: Request,
  password: string,
  { attempts, now }: AuthGateOptions,
): Promise<Response> {
  const client = clientKey(request)
  if (!(await attempts.reserve(client))) return loginFailed('locked')

  const submitted = await readSubmittedPassword(request)
  if (submitted === null || !(await isSecretCorrect(submitted, password))) {
    return loginFailed('invalid')
  }

  await attempts.clear(client)
  return redirect('/', await createSessionCookie(password, now()))
}

async function handleLogin(request: Request, options: AuthGateOptions): Promise<Response> {
  if (!isSameOrigin(request)) return refuse(HTTP_FORBIDDEN, 'Forbidden')
  if (!(await isBodyWithinLimit(request))) {
    return refuse(HTTP_PAYLOAD_TOO_LARGE, 'Request too large')
  }
  if (options.password === null) return loginFailed('setup')

  try {
    return await verifyLogin(request, options.password, options)
  } catch (error) {
    console.error('Could not process the login:', error)
    return loginFailed('unavailable')
  }
}

function handleLogout(request: Request): Response {
  if (!isSameOrigin(request)) return refuse(HTTP_FORBIDDEN, 'Forbidden')
  return redirect(LOGIN_PAGE, clearedSessionCookie())
}

function isPageRequest(request: Request): boolean {
  return (
    ['GET', 'HEAD'].includes(request.method) &&
    (request.headers.get('accept') ?? '').includes('text/html')
  )
}

function isReadingLoginPage(request: Request, pathname: string): boolean {
  return pathname === LOGIN_PAGE && ['GET', 'HEAD'].includes(request.method)
}

/** Returns the response to send instead of the app, or null to let the request through. */
export async function checkRequest(
  request: Request,
  options: AuthGateOptions,
): Promise<Response | null> {
  const { pathname } = new URL(request.url)
  if (request.method === 'POST' && pathname === LOGIN_ENDPOINT) {
    return handleLogin(request, options)
  }
  if (request.method === 'POST' && pathname === LOGOUT_ENDPOINT) {
    return handleLogout(request)
  }

  const isSignedIn =
    options.password !== null &&
    (await isSessionValid(request.headers.get('cookie'), options.password, options.now()))

  if (isReadingLoginPage(request, pathname)) return isSignedIn ? redirect('/') : null
  if (isSignedIn) return null
  return isPageRequest(request) ? redirect(LOGIN_PAGE) : refuse(HTTP_UNAUTHORIZED, 'Unauthorized')
}

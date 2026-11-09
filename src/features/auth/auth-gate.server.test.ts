// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { canSkipLogin, checkRequest, type AuthGateOptions } from './auth-gate.server'
import { MAX_PASSWORD_LENGTH } from './login-model'
import { MAX_REQUEST_BODY_BYTES } from './request-limits'
import { createSessionCookie } from './password-session.server'

const ORIGIN = 'https://board.test'
const PASSWORD = 'test-only-password'
const NOW = 1_800_000_000_000

function options(overrides: Partial<AuthGateOptions> = {}): AuthGateOptions {
  return {
    password: PASSWORD,
    now: () => NOW,
    attempts: {
      reserve: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  }
}

function page(path: string, cookie?: string): Request {
  return new Request(`${ORIGIN}${path}`, {
    headers: { accept: 'text/html', ...(cookie ? { cookie } : {}) },
  })
}

function login(
  password: string,
  headers: Record<string, string> = { origin: ORIGIN },
): Request {
  return new Request(`${ORIGIN}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'cf-connecting-ip': '203.0.113.1',
      ...headers,
    },
    body: new URLSearchParams({ password }),
  })
}

async function validCookie(): Promise<string> {
  return (await createSessionCookie(PASSWORD, NOW)).split(';')[0]
}

describe('canSkipLogin', () => {
  it('skips login only for a development build on this computer', () => {
    expect(canSkipLogin(true, new Request('http://localhost:3000/'))).toBe(true)
  })

  it('never skips login on the real site, even if built in development mode', () => {
    expect(canSkipLogin(true, new Request('https://board.test/'))).toBe(false)
  })

  it('never skips login in a production build', () => {
    expect(canSkipLogin(false, new Request('http://localhost:3000/'))).toBe(false)
  })
})

describe('checkRequest: response headers', () => {
  it('tells browsers not to guess the content type', async () => {
    const redirected = await checkRequest(page('/'), options())
    const refused = await checkRequest(
      new Request(`${ORIGIN}/_serverFn/board`, { method: 'POST' }),
      options(),
    )

    expect(redirected?.headers.get('x-content-type-options')).toBe('nosniff')
    expect(refused?.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('checkRequest: reading the site', () => {
  it('sends a page request without a session to the login page', async () => {
    const response = await checkRequest(page('/'), options())

    expect(response?.status).toBe(303)
    expect(response?.headers.get('location')).toBe('/login')
  })

  it('refuses a data request without a session', async () => {
    const request = new Request(`${ORIGIN}/_serverFn/board`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })

    const response = await checkRequest(request, options())

    expect(response?.status).toBe(401)
  })

  it('lets a request with a valid session through', async () => {
    expect(await checkRequest(page('/', await validCookie()), options())).toBeNull()
  })

  it('refuses a forged session', async () => {
    const response = await checkRequest(
      page('/', `__Host-board-session=1900000000000.${'a'.repeat(64)}`),
      options(),
    )

    expect(response?.headers.get('location')).toBe('/login')
  })

  it('shows the login page to someone signed out', async () => {
    expect(await checkRequest(page('/login'), options())).toBeNull()
  })

  it('skips the login page for someone already signed in', async () => {
    const response = await checkRequest(page('/login', await validCookie()), options())

    expect(response?.headers.get('location')).toBe('/')
  })

  it('only opens the login page for reading', async () => {
    const request = new Request(`${ORIGIN}/login`, { method: 'POST', body: 'x' })

    expect((await checkRequest(request, options()))?.status).toBe(401)
  })

  it('lets nobody in when no password is set', async () => {
    const response = await checkRequest(
      page('/', await validCookie()),
      options({ password: null }),
    )

    expect(response?.headers.get('location')).toBe('/login')
  })

  it('is never cached', async () => {
    const response = await checkRequest(page('/'), options())

    expect(response?.headers.get('cache-control')).toBe('no-store')
  })
})

describe('checkRequest: logging in', () => {
  it('signs in with the right password', async () => {
    const gate = options()

    const response = await checkRequest(login(PASSWORD), gate)

    expect(response?.status).toBe(303)
    expect(response?.headers.get('location')).toBe('/')
    expect(response?.headers.get('set-cookie')).toContain('HttpOnly')
    expect(gate.attempts.clear).toHaveBeenCalledWith('203.0.113.1')
  })

  it('issues a session that the gate then accepts', async () => {
    const response = await checkRequest(login(PASSWORD), options())
    const cookie = response?.headers.get('set-cookie')?.split(';')[0]

    expect(await checkRequest(page('/', cookie), options())).toBeNull()
  })

  it('refuses the wrong password without a session', async () => {
    const gate = options()

    const response = await checkRequest(login('wrong-password'), gate)

    expect(response?.headers.get('location')).toBe('/login?error=invalid')
    expect(response?.headers.get('set-cookie')).toBeNull()
    expect(gate.attempts.clear).not.toHaveBeenCalled()
  })

  it('refuses even the right password while locked out', async () => {
    const response = await checkRequest(
      login(PASSWORD),
      options({
        attempts: { reserve: vi.fn().mockResolvedValue(false), clear: vi.fn() },
      }),
    )

    expect(response?.headers.get('location')).toBe('/login?error=locked')
    expect(response?.headers.get('set-cookie')).toBeNull()
  })

  it('says so when no password has been set', async () => {
    const gate = options({ password: null })

    const response = await checkRequest(login(PASSWORD), gate)

    expect(response?.headers.get('location')).toBe('/login?error=setup')
    expect(gate.attempts.reserve).not.toHaveBeenCalled()
  })

  it('fails safely when attempts cannot be counted', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await checkRequest(
      login(PASSWORD),
      options({
        attempts: { reserve: vi.fn().mockRejectedValue(new Error('down')), clear: vi.fn() },
      }),
    )

    expect(response?.headers.get('location')).toBe('/login?error=unavailable')
    expect(response?.headers.get('set-cookie')).toBeNull()
    consoleError.mockRestore()
  })

  it.each([
    ['another site', { origin: 'https://evil.test' }],
    ['no origin at all', {}],
  ])('refuses a login sent from %s', async (_label, headers) => {
    const response = await checkRequest(login(PASSWORD, headers), options())

    expect(response?.status).toBe(403)
  })

  it('treats a password over the limit as wrong', async () => {
    const response = await checkRequest(
      login('x'.repeat(MAX_PASSWORD_LENGTH + 1)),
      options({ password: 'x'.repeat(MAX_PASSWORD_LENGTH + 1) }),
    )

    expect(response?.headers.get('location')).toBe('/login?error=invalid')
  })

  it('treats a body that is not a form as wrong', async () => {
    const request = new Request(`${ORIGIN}/api/login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: '{"password":"test-only-password"}',
    })

    const response = await checkRequest(request, options())

    expect(response?.headers.get('location')).toBe('/login?error=invalid')
  })

  it('refuses an oversized request before reading it as a form', async () => {
    const response = await checkRequest(
      login('x'.repeat(MAX_REQUEST_BODY_BYTES + 1)),
      options(),
    )

    expect(response?.status).toBe(413)
  })

  it('counts every address in the same IPv6 network as one client', async () => {
    const gate = options()

    await checkRequest(
      login('wrong-password', {
        origin: ORIGIN,
        'cf-connecting-ip': '2001:db8:1:2:aaaa:bbbb:cccc:dddd',
      }),
      gate,
    )

    expect(gate.attempts.reserve).toHaveBeenCalledWith('2001:db8:1:2')
  })

  it('counts a shortened IPv6 address in its full network', async () => {
    const gate = options()

    await checkRequest(
      login('wrong-password', { origin: ORIGIN, 'cf-connecting-ip': '2001::2:a:b:c:d' }),
      gate,
    )

    expect(gate.attempts.reserve).toHaveBeenCalledWith('2001:0:0:2')
  })
})

describe('checkRequest: logging out', () => {
  function logout(headers: Record<string, string>): Request {
    return new Request(`${ORIGIN}/api/logout`, { method: 'POST', headers })
  }

  it('removes the session and returns to the login page', async () => {
    const response = await checkRequest(logout({ origin: ORIGIN }), options())

    expect(response?.status).toBe(303)
    expect(response?.headers.get('location')).toBe('/login')
    expect(response?.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('refuses a logout sent from another site', async () => {
    const response = await checkRequest(
      logout({ origin: 'https://evil.test' }),
      options(),
    )

    expect(response?.status).toBe(403)
  })
})

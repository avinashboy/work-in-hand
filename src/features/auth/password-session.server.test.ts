// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE_NAME,
  SESSION_LIFETIME_MS,
  clearedSessionCookie,
  createSessionCookie,
  isSecretCorrect,
  isSessionValid,
  parsePassword,
} from './password-session.server'

const PASSWORD = 'test-only-password'
const NOW = 1_800_000_000_000

function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(';')[0]
}

describe('parsePassword', () => {
  it('returns the password when one is set', () => {
    expect(parsePassword({ APP_PASSWORD: PASSWORD })).toBe(PASSWORD)
  })

  it.each([
    ['missing', {}],
    ['empty', { APP_PASSWORD: '' }],
    ['too short', { APP_PASSWORD: 'elevenchars' }],
    ['not text', { APP_PASSWORD: 12345678 }],
  ])('refuses a password that is %s', (_label, env) => {
    expect(parsePassword(env)).toBeNull()
  })
})

describe('isSecretCorrect', () => {
  it('accepts the exact password', async () => {
    expect(await isSecretCorrect(PASSWORD, PASSWORD)).toBe(true)
  })

  it.each(['', 'wrong', `${PASSWORD} `, PASSWORD.toUpperCase()])(
    'refuses "%s"',
    async (attempt) => {
      expect(await isSecretCorrect(attempt, PASSWORD)).toBe(false)
    },
  )
})

describe('session cookie', () => {
  it('is locked down so scripts and other sites cannot use it', async () => {
    const cookie = await createSessionCookie(PASSWORD, NOW)

    expect(cookie.startsWith(`${SESSION_COOKIE_NAME}=`)).toBe(true)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })

  it('never contains the password', async () => {
    expect(await createSessionCookie(PASSWORD, NOW)).not.toContain(PASSWORD)
  })

  it('is valid until it expires, a year later', async () => {
    const header = cookieHeaderFrom(await createSessionCookie(PASSWORD, NOW))

    expect(await isSessionValid(header, PASSWORD, NOW)).toBe(true)
    expect(await isSessionValid(header, PASSWORD, NOW + SESSION_LIFETIME_MS - 1)).toBe(true)
    expect(await isSessionValid(header, PASSWORD, NOW + SESSION_LIFETIME_MS)).toBe(false)
  })

  it('is found among other cookies', async () => {
    const header = cookieHeaderFrom(await createSessionCookie(PASSWORD, NOW))

    expect(await isSessionValid(`a=1; ${header}; b=2`, PASSWORD, NOW)).toBe(true)
  })

  it('stops working when the password is changed', async () => {
    const header = cookieHeaderFrom(await createSessionCookie(PASSWORD, NOW))

    expect(await isSessionValid(header, 'a-different-password', NOW)).toBe(false)
  })

  it('refuses a cookie whose expiry was extended', async () => {
    const header = cookieHeaderFrom(await createSessionCookie(PASSWORD, NOW))
    const value = header.split('=')[1]
    const signature = value.split('.')[1]
    const forged = `${SESSION_COOKIE_NAME}=${NOW + SESSION_LIFETIME_MS * 2}.${signature}`

    expect(
      await isSessionValid(forged, PASSWORD, NOW + SESSION_LIFETIME_MS + 1),
    ).toBe(false)
  })

  it.each([
    null,
    '',
    'other=1',
    `${SESSION_COOKIE_NAME}=`,
    `${SESSION_COOKIE_NAME}=nonsense`,
    `${SESSION_COOKIE_NAME}=1900000000000.nothex`,
    `${SESSION_COOKIE_NAME}=1900000000000.${'0'.repeat(64)}`,
  ])('refuses the cookie header %s', async (header) => {
    expect(await isSessionValid(header, PASSWORD, NOW)).toBe(false)
  })

  it('is removed by the logout cookie', () => {
    const cleared = clearedSessionCookie()

    expect(cleared.startsWith(`${SESSION_COOKIE_NAME}=;`)).toBe(true)
    expect(cleared).toContain('Max-Age=0')
  })
})

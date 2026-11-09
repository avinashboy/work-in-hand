// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { hashPassword } from './auth-password.server'
import {
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_WINDOW_MS,
  SESSION_TTL_MS,
  createAuthService,
  type AuthService,
} from './auth-service.server'

const PASSWORD = 'correct horse battery staple'
const WRONG = 'not the password at all'
const FAST_COST = 1024
const START = 1_000_000

async function tokenFrom(service: AuthService): Promise<string> {
  const outcome = await service.login(PASSWORD)
  if (outcome.status !== 'ok') throw new Error(`login failed: ${outcome.status}`)
  return outcome.token
}

describe('auth service', () => {
  let directory: string
  let path: string
  let passwordHash: string
  let clock: number
  let service: AuthService

  const open = (hash = passwordHash) =>
    createAuthService({ path, now: () => clock, passwordHash: hash })

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD, FAST_COST)
  })

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'auth-db-'))
    path = join(directory, 'board.db')
    clock = START
    service = open()
  })

  afterEach(() => {
    service.close()
    rmSync(directory, { recursive: true, force: true })
  })

  describe('logging in', () => {
    it('signs in with the right password', async () => {
      const token = await tokenFrom(service)

      expect(service.isSignedIn(token)).toBe(true)
    })

    it('refuses the wrong password and gives no token', async () => {
      const outcome = await service.login(WRONG)

      expect(outcome).toEqual({ status: 'invalid' })
    })

    it('gives a new token on every login', async () => {
      expect(await tokenFrom(service)).not.toBe(await tokenFrom(service))
    })

    it('refuses everyone when no password is set up', async () => {
      const blank = createAuthService({
        path,
        now: () => clock,
        passwordHash: undefined,
      })

      expect(await blank.login('')).toEqual({ status: 'unconfigured' })
      expect(await blank.login(PASSWORD)).toEqual({ status: 'unconfigured' })
      blank.close()
    })

    it('refuses everyone when the stored hash is malformed', async () => {
      const broken = createAuthService({
        path,
        now: () => clock,
        passwordHash: 'not-a-hash',
      })

      expect(await broken.login(PASSWORD)).toEqual({ status: 'unconfigured' })
      broken.close()
    })
  })

  describe('limiting guesses', () => {
    async function useUpAttempts() {
      for (let index = 0; index < LOGIN_ATTEMPT_LIMIT; index += 1) {
        await service.login(WRONG)
      }
    }

    it('locks after too many wrong passwords', async () => {
      await useUpAttempts()

      expect(await service.login(WRONG)).toEqual({ status: 'locked' })
    })

    it('refuses even the right password while locked', async () => {
      await useUpAttempts()

      expect(await service.login(PASSWORD)).toEqual({ status: 'locked' })
    })

    it('unlocks once the window has passed', async () => {
      await useUpAttempts()
      clock += LOGIN_WINDOW_MS + 1

      expect((await service.login(PASSWORD)).status).toBe('ok')
    })

    it('forgets earlier mistakes after a successful login', async () => {
      for (let index = 0; index < LOGIN_ATTEMPT_LIMIT - 1; index += 1) {
        await service.login(WRONG)
      }
      await tokenFrom(service)
      await service.login(WRONG)

      expect((await service.login(PASSWORD)).status).toBe('ok')
    })

    it('counts a burst of parallel guesses against the limit', async () => {
      const extra = 5
      const guesses = Array.from({ length: LOGIN_ATTEMPT_LIMIT + extra }, () =>
        service.login(WRONG),
      )

      const outcomes = await Promise.all(guesses)

      expect(outcomes.filter(({ status }) => status === 'locked')).toHaveLength(extra)
    })

    it('leaves someone already signed in alone during a lockout', async () => {
      const token = await tokenFrom(service)
      await useUpAttempts()

      expect(service.isSignedIn(token)).toBe(true)
    })

    it('keeps the lockout across a restart', async () => {
      await useUpAttempts()
      service.close()
      service = open()

      expect(await service.login(PASSWORD)).toEqual({ status: 'locked' })
    })
  })

  describe('sessions', () => {
    it('treats a missing token as signed out', () => {
      expect(service.isSignedIn(undefined)).toBe(false)
    })

    it('rejects a token it never issued', () => {
      expect(service.isSignedIn('made-up-token')).toBe(false)
    })

    it('expires after the session lifetime', async () => {
      const token = await tokenFrom(service)

      clock += SESSION_TTL_MS

      expect(service.isSignedIn(token)).toBe(false)
    })

    it('is still valid just before expiry', async () => {
      const token = await tokenFrom(service)

      clock += SESSION_TTL_MS - 1

      expect(service.isSignedIn(token)).toBe(true)
    })

    it('ends on logout', async () => {
      const token = await tokenFrom(service)

      service.logout(token)

      expect(service.isSignedIn(token)).toBe(false)
    })

    it('logout without a token does nothing', async () => {
      const token = await tokenFrom(service)

      service.logout(undefined)

      expect(service.isSignedIn(token)).toBe(true)
    })

    it('survives a server restart', async () => {
      const token = await tokenFrom(service)
      service.close()
      service = open()

      expect(service.isSignedIn(token)).toBe(true)
    })

    it('signs out every device when the password changes', async () => {
      const token = await tokenFrom(service)
      service.close()
      service = open(await hashPassword('a completely new password', FAST_COST))

      expect(service.isSignedIn(token)).toBe(false)
    })

    it('never writes the token to the database', async () => {
      const token = await tokenFrom(service)

      expect(readFileSync(path).includes(token)).toBe(false)
    })
  })
})

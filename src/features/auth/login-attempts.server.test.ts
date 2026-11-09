// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { createLoginAttempts } from './login-attempts.server'
import {
  LOGIN_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS,
  MAX_LOGIN_ATTEMPTS_ALL_CLIENTS,
} from './login-model'

const START = 1_800_000_000_000

describe('login attempts', () => {
  let db: TestDatabase
  let time: number

  function attempts() {
    return createLoginAttempts({ db, now: () => time })
  }

  function useAllowedAttempts(client: string) {
    const store = attempts()
    Array.from({ length: MAX_LOGIN_ATTEMPTS }).forEach(() => {
      expect(store.reserve(client)).toBe(true)
    })
    return store
  }

  beforeEach(() => {
    db = openTestDatabase()
    time = START
  })

  it('refuses a client once it has used all its attempts', () => {
    const store = useAllowedAttempts('203.0.113.1')

    expect(store.reserve('203.0.113.1')).toBe(false)
  })

  it('keeps each client separate', () => {
    const store = useAllowedAttempts('203.0.113.1')

    expect(store.reserve('203.0.113.2')).toBe(true)
  })

  it('gives attempts back after a successful login', () => {
    const store = useAllowedAttempts('203.0.113.1')

    store.clear('203.0.113.1')

    expect(store.reserve('203.0.113.1')).toBe(true)
  })

  it('lets a client try again once the window has passed', () => {
    const store = useAllowedAttempts('203.0.113.1')

    time = START + LOGIN_WINDOW_MS

    expect(store.reserve('203.0.113.1')).toBe(true)
  })

  it('does not extend a lock when a blocked client keeps trying', () => {
    const store = useAllowedAttempts('203.0.113.1')

    time = START + LOGIN_WINDOW_MS - 1
    expect(store.reserve('203.0.113.1')).toBe(false)

    time = START + LOGIN_WINDOW_MS
    expect(store.reserve('203.0.113.1')).toBe(true)
  })

  it('remembers attempts when the object wakes up again', () => {
    useAllowedAttempts('203.0.113.1')

    expect(attempts().reserve('203.0.113.1')).toBe(false)
  })

  it('throws away old records so the table cannot grow forever', () => {
    const store = attempts()
    store.reserve('203.0.113.1')

    time = START + LOGIN_WINDOW_MS
    store.reserve('203.0.113.2')

    expect(db.query('SELECT client FROM login_attempts')).not.toContainEqual({
      client: '203.0.113.1',
    })
  })

  it('stops all guessing once too many addresses have tried', () => {
    const store = attempts()
    Array.from({ length: MAX_LOGIN_ATTEMPTS_ALL_CLIENTS }).forEach((_, index) => {
      expect(store.reserve(`client-${index}`)).toBe(true)
    })

    expect(store.reserve('one-more-client')).toBe(false)
  })

  it('opens again for everyone once the window has passed', () => {
    const store = attempts()
    Array.from({ length: MAX_LOGIN_ATTEMPTS_ALL_CLIENTS }).forEach((_, index) => {
      store.reserve(`client-${index}`)
    })

    time = START + LOGIN_WINDOW_MS

    expect(store.reserve('one-more-client')).toBe(true)
  })
})

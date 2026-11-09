// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from './auth-password.server'

const FAST_COST = 1024
const PASSWORD = 'correct horse battery staple'

describe('password hashing', () => {
  it('accepts the right password', async () => {
    const stored = await hashPassword(PASSWORD, FAST_COST)

    expect(await verifyPassword(PASSWORD, stored)).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword(PASSWORD, FAST_COST)

    expect(await verifyPassword(`${PASSWORD}!`, stored)).toBe(false)
  })

  it('never stores the password itself', async () => {
    const stored = await hashPassword(PASSWORD, FAST_COST)

    expect(stored).not.toContain(PASSWORD)
  })

  it('salts, so one password hashes differently each time', async () => {
    const first = await hashPassword(PASSWORD, FAST_COST)
    const second = await hashPassword(PASSWORD, FAST_COST)

    expect(first).not.toBe(second)
  })

  it('survives a .env file, which would expand a dollar sign', async () => {
    const stored = await hashPassword(PASSWORD, FAST_COST)

    expect(stored).not.toContain('$')
  })

  it.each([
    '',
    'plain-text-password',
    'scrypt:abc:8:1:c2FsdA:aGFzaA',
    'scrypt:1024:8:1::',
    'md5:1024:8:1:c2FsdA:aGFzaA',
    'scrypt:1048576000:8:1:c2FsdA:aGFzaA',
    'scrypt:1000:8:1:c2FsdA:aGFzaA',
  ])('treats %j as not a usable hash', async (stored) => {
    expect(isPasswordHash(stored)).toBe(false)
    expect(await verifyPassword(PASSWORD, stored)).toBe(false)
  })

  it('recognises a real hash', async () => {
    expect(isPasswordHash(await hashPassword(PASSWORD, FAST_COST))).toBe(true)
  })
})

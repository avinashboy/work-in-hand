import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import { createSerialQueue } from '../../lib/serial-queue'
import { inTransaction, openDatabase } from '../../lib/sqlite.server'
import { LOGIN_LOCK_MINUTES, type LoginStatus } from './auth-model'
import { isPasswordHash, verifyPassword } from './auth-password.server'

export const LOGIN_ATTEMPT_LIMIT = 10
export const LOGIN_WINDOW_MS = LOGIN_LOCK_MINUTES * 60 * 1000
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

const SESSION_TOKEN_BYTES = 32

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_login_attempts (
    attempted_at INTEGER NOT NULL
  );
`

const countRowSchema = z.object({ total: z.number() })

export type LoginOutcome =
  | { readonly status: 'ok'; readonly token: string }
  | { readonly status: Exclude<LoginStatus, 'ok'> }

export interface AuthService {
  login: (password: string) => Promise<LoginOutcome>
  isSignedIn: (token: string | undefined) => boolean
  logout: (token: string | undefined) => void
  close: () => void
}

interface AuthServiceOptions {
  readonly path: string
  readonly now: () => number
  readonly passwordHash: string | undefined
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Takes a slot before the slow hash runs, so parallel guesses all count. */
function consumeLoginAttempt(db: DatabaseSync, now: number): boolean {
  return inTransaction(db, () => {
    db.prepare('DELETE FROM auth_login_attempts WHERE attempted_at <= ?').run(
      now - LOGIN_WINDOW_MS,
    )
    const { total } = countRowSchema.parse(
      db.prepare('SELECT COUNT(*) AS total FROM auth_login_attempts').get(),
    )
    if (total >= LOGIN_ATTEMPT_LIMIT) return false

    db.prepare('INSERT INTO auth_login_attempts (attempted_at) VALUES (?)').run(now)
    return true
  })
}

function createSession(
  db: DatabaseSync,
  credentialId: string,
  now: number,
): string {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url')
  inTransaction(db, () => {
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now)
    db.exec('DELETE FROM auth_login_attempts')
    db.prepare(
      `INSERT INTO auth_sessions (token_hash, credential_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).run(sha256(token), credentialId, now, now + SESSION_TTL_MS)
  })
  return token
}

export function createAuthService({
  path,
  now,
  passwordHash,
}: AuthServiceOptions): AuthService {
  const db = openDatabase(path)
  db.exec(SCHEMA)

  const usableHash =
    passwordHash !== undefined && isPasswordHash(passwordHash)
      ? passwordHash
      : null
  // A session only counts for the password it was created with.
  const credentialId = usableHash === null ? null : sha256(usableHash)
  // Each check needs ~128 MB, so a burst of guesses mustn't run them together.
  const runHashCheck = createSerialQueue()

  return {
    login: async (password) => {
      if (usableHash === null || credentialId === null) {
        return { status: 'unconfigured' }
      }
      if (!consumeLoginAttempt(db, now())) return { status: 'locked' }
      const isCorrect = await runHashCheck(() =>
        verifyPassword(password, usableHash),
      )
      if (!isCorrect) return { status: 'invalid' }
      return { status: 'ok', token: createSession(db, credentialId, now()) }
    },
    isSignedIn: (token) => {
      if (token === undefined || credentialId === null) return false
      return (
        db
          .prepare(
            `SELECT 1 FROM auth_sessions
             WHERE token_hash = ? AND credential_id = ? AND expires_at > ?`,
          )
          .get(sha256(token), credentialId, now()) !== undefined
      )
    },
    logout: (token) => {
      if (token === undefined) return
      db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha256(token))
    },
    close: () => db.close(),
  }
}

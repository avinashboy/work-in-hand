import { z } from 'zod'
import { MIN_PASSWORD_LENGTH } from './login-model'

export const SESSION_COOKIE_NAME = '__Host-board-session'
export const SESSION_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000

const SIGNATURE_ALGORITHM = 'HMAC'
const SESSION_TOKEN = /^(\d{1,16})\.([0-9a-f]{64})$/

const encoder = new TextEncoder()
const passwordEnvSchema = z.object({
  APP_PASSWORD: z.string().min(MIN_PASSWORD_LENGTH),
})

export function parsePassword(env: unknown): string | null {
  const parsed = passwordEnvSchema.safeParse(env)
  return parsed.success ? parsed.data.APP_PASSWORD : null
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: SIGNATURE_ALGORITHM, hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Compares through a keyed hash, so response time reveals nothing about the secret. */
export async function isSecretCorrect(attempt: string, secret: string): Promise<boolean> {
  const key = await importKey('secret-check')
  const expected = await crypto.subtle.sign(SIGNATURE_ALGORITHM, key, encoder.encode(secret))
  return crypto.subtle.verify(SIGNATURE_ALGORITHM, key, expected, encoder.encode(attempt))
}

// Derived from the password, so changing the password signs every browser out.
function sessionKey(password: string): Promise<CryptoKey> {
  return importKey(`session:${password}`)
}

function sessionPayload(expiresAt: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(`session:${expiresAt}`)
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
}

/** Stateless: the signed expiry time is the whole session, so nothing is stored per browser. */
export async function createSessionCookie(password: string, now: number): Promise<string> {
  const expiresAt = String(now + SESSION_LIFETIME_MS)
  const signature = await crypto.subtle.sign(
    SIGNATURE_ALGORITHM,
    await sessionKey(password),
    sessionPayload(expiresAt),
  )
  const maxAgeSeconds = SESSION_LIFETIME_MS / 1000
  return `${SESSION_COOKIE_NAME}=${expiresAt}.${toHex(signature)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

function readSessionToken(cookieHeader: string | null): string | undefined {
  const prefix = `${SESSION_COOKIE_NAME}=`
  return cookieHeader
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length)
}

export async function isSessionValid(
  cookieHeader: string | null,
  password: string,
  now: number,
): Promise<boolean> {
  const match = SESSION_TOKEN.exec(readSessionToken(cookieHeader) ?? '')
  if (!match) return false

  const [, expiresAt, signature] = match
  if (Number(expiresAt) <= now) return false

  return crypto.subtle.verify(
    SIGNATURE_ALGORITHM,
    await sessionKey(password),
    fromHex(signature),
    sessionPayload(expiresAt),
  )
}

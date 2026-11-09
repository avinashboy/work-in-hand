import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export const MIN_PASSWORD_LENGTH = 12

const ALGORITHM = 'scrypt'
const DEFAULT_COST = 2 ** 17 // OWASP's recommended minimum for scrypt.
const MAX_COST = 2 ** 18
const BLOCK_SIZE = 8
const PARALLELISM = 1
const SALT_BYTES = 16
const KEY_BYTES = 32
// Colons, because a .env loader may expand the usual dollar-sign format.
const HASH_PATTERN = /^scrypt:(\d+):(\d+):(\d+):([\w-]+):([\w-]+)$/

interface ScryptParameters {
  readonly cost: number
  readonly blockSize: number
  readonly parallelism: number
}

function derive(
  password: string,
  salt: Buffer,
  keyBytes: number,
  { cost, blockSize, parallelism }: ScryptParameters,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyBytes,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
        maxmem: 2 * 128 * cost * blockSize,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })
}

function isPowerOfTwo(value: number): boolean {
  return value > 1 && Number.isInteger(Math.log2(value))
}

function parseHash(stored: string) {
  const match = HASH_PATTERN.exec(stored)
  if (!match) return null

  const cost = Number(match[1])
  const blockSize = Number(match[2])
  const parallelism = Number(match[3])
  const salt = Buffer.from(match[4], 'base64url')
  const key = Buffer.from(match[5], 'base64url')
  const isSafe =
    isPowerOfTwo(cost) &&
    cost <= MAX_COST &&
    blockSize === BLOCK_SIZE &&
    parallelism === PARALLELISM &&
    salt.length > 0 &&
    key.length > 0

  return isSafe ? { cost, blockSize, parallelism, salt, key } : null
}

export function isPasswordHash(stored: string): boolean {
  return parseHash(stored) !== null
}

export async function hashPassword(
  password: string,
  cost: number = DEFAULT_COST,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, KEY_BYTES, {
    cost,
    blockSize: BLOCK_SIZE,
    parallelism: PARALLELISM,
  })
  return [
    ALGORITHM,
    cost,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join(':')
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseHash(stored)
  if (!parsed) return false

  const candidate = await derive(password, parsed.salt, parsed.key.length, parsed)
  return timingSafeEqual(candidate, parsed.key)
}

import {
  deleteCookie,
  getCookie,
  setCookie,
  setResponseStatus,
} from '@tanstack/react-start/server'
import { getDatabasePath } from '../../lib/sqlite.server'
import { createUnauthenticatedError, type LoginStatus } from './auth-model'
import { isPasswordHash } from './auth-password.server'
import {
  SESSION_TTL_MS,
  createAuthService,
  type AuthService,
} from './auth-service.server'

// __Host- makes browsers refuse the cookie unless it's Secure and host-only.
const SESSION_COOKIE = import.meta.env.PROD
  ? '__Host-board_session'
  : 'board_session'
const HTTP_UNAUTHORIZED = 401

let sharedService: AuthService | undefined

function loadLocalEnvFile(): void {
  try {
    process.loadEnvFile('.env') // Never overrides what the host has already set.
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function getAuthService(): AuthService {
  if (sharedService) return sharedService

  loadLocalEnvFile()
  const passwordHash = process.env.BOARD_PASSWORD_HASH
  if (passwordHash === undefined || !isPasswordHash(passwordHash)) {
    console.error(
      'BOARD_PASSWORD_HASH is missing or invalid, so nobody can log in. Run: npm run set-password',
    )
  }
  sharedService = createAuthService({
    path: getDatabasePath(),
    now: Date.now,
    passwordHash,
  })
  return sharedService
}

export function isRequestSignedIn(): boolean {
  return getAuthService().isSignedIn(getCookie(SESSION_COOKIE))
}

export function assertRequestSignedIn(): void {
  if (isRequestSignedIn()) return
  setResponseStatus(HTTP_UNAUTHORIZED)
  throw createUnauthenticatedError()
}

export async function logInRequest(password: string): Promise<LoginStatus> {
  const outcome = await getAuthService().login(password)
  if (outcome.status === 'ok') {
    setCookie(SESSION_COOKIE, outcome.token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    })
  }
  return outcome.status
}

export function logOutRequest(): void {
  getAuthService().logout(getCookie(SESSION_COOKIE))
  deleteCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
  })
}

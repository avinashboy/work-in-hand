import { z } from 'zod'

export const MAX_PASSWORD_LENGTH = 256
export const LOGIN_LOCK_MINUTES = 15

const UNAUTHENTICATED_MESSAGE = 'Not signed in'

export const loginInputSchema = z.object({
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
})

export type LoginStatus = 'ok' | 'invalid' | 'locked' | 'unconfigured'

export function createUnauthenticatedError(): Error {
  return new Error(UNAUTHENTICATED_MESSAGE)
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof Error && error.message === UNAUTHENTICATED_MESSAGE
}

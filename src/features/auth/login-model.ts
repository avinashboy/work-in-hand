export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 256
export const MAX_LOGIN_ATTEMPTS = 5
// Slows guessing spread over many addresses. Browsers already signed in aren't affected.
export const MAX_LOGIN_ATTEMPTS_ALL_CLIENTS = 30
export const LOGIN_LOCK_MINUTES = 15
export const LOGIN_WINDOW_MS = LOGIN_LOCK_MINUTES * 60 * 1000

export const LOGIN_ERRORS = ['invalid', 'locked', 'setup', 'unavailable'] as const
export type LoginError = (typeof LOGIN_ERRORS)[number]

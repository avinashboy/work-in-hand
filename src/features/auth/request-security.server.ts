import { randomBytes } from 'node:crypto'
import { setResponseHeader } from '@tanstack/react-start/server'

const NONCE_BYTES = 16

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Drag and drop positions cards with inline style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** Sets the headers for this response and returns its script nonce. */
export function applySecurityHeaders(): string {
  const nonce = randomBytes(NONCE_BYTES).toString('base64')

  setResponseHeader('X-Content-Type-Options', 'nosniff')
  setResponseHeader('X-Frame-Options', 'DENY')
  setResponseHeader('Referrer-Policy', 'same-origin')
  setResponseHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // Pages hold private data, so shared caches and the back button mustn't keep them.
  setResponseHeader('Cache-Control', 'no-store')

  if (import.meta.env.PROD) {
    setResponseHeader('Content-Security-Policy', contentSecurityPolicy(nonce))
    setResponseHeader('Strict-Transport-Security', 'max-age=31536000')
  }
  return nonce
}

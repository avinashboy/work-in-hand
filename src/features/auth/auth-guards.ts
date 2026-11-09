import { redirect } from '@tanstack/react-router'
import { getSessionStatus } from './auth-api'

export async function requireSession(): Promise<void> {
  const { signedIn } = await getSessionStatus()
  if (!signedIn) throw redirect({ to: '/login' })
}

export async function redirectIfSignedIn(): Promise<void> {
  const { signedIn } = await getSessionStatus()
  if (signedIn) throw redirect({ to: '/' })
}

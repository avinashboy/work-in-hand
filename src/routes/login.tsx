import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginView } from '../features/auth/components/LoginView'
import { LOGIN_ERRORS } from '../features/auth/login-model'

const loginSearchSchema = z.object({
  error: z.enum(LOGIN_ERRORS).optional().catch(undefined),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [{ title: 'Log in' }],
  }),
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()
  return <LoginView error={error} />
}

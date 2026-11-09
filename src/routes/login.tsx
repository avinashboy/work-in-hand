import { createFileRoute } from '@tanstack/react-router'
import { redirectIfSignedIn } from '../features/auth/auth-guards'
import { LoginView } from '../features/auth/components/LoginView'

export const Route = createFileRoute('/login')({
  beforeLoad: redirectIfSignedIn,
  head: () => ({
    meta: [{ title: 'Log in' }],
  }),
  component: LoginView,
})

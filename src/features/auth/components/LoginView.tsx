import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ThemeSwitch } from '../../board/components/ThemeSwitch'
import { logIn } from '../auth-api'
import {
  LOGIN_LOCK_MINUTES,
  MAX_PASSWORD_LENGTH,
  type LoginStatus,
} from '../auth-model'

const FAILURE_MESSAGES: Record<Exclude<LoginStatus, 'ok'>, string> = {
  invalid: 'That password isn’t right.',
  locked: `Too many tries. Wait ${LOGIN_LOCK_MINUTES} minutes, then try again.`,
  unconfigured: 'No password has been set up on this server yet.',
}
const NETWORK_FAILURE = 'Couldn’t reach the server. Try again.'

export function LoginView() {
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: (value: string) => logIn({ data: { password: value } }),
    onSuccess: ({ status }) => {
      if (status === 'ok') {
        // A full load, so nothing from before signing in stays in memory.
        window.location.assign('/')
      } else {
        setPassword('')
      }
    },
  })

  const isBusy = login.isPending || login.data?.status === 'ok'
  const failure =
    login.isError
      ? NETWORK_FAILURE
      : login.data && login.data.status !== 'ok'
        ? FAILURE_MESSAGES[login.data.status]
        : null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate(password)
  }

  return (
    <main className="board-page">
      <header className="masthead">
        <h1>Work in Hand</h1>
        <div className="masthead-meta">
          <ThemeSwitch />
        </div>
      </header>

      <form className="login-form" onSubmit={submit}>
        <h2>Private board</h2>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          maxLength={MAX_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={isBusy}>
          {isBusy ? 'Checking…' : 'Log in'}
        </button>
        <p className="login-error" role="alert">
          {failure}
        </p>
      </form>
    </main>
  )
}

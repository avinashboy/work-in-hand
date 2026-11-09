import { ThemeSwitch } from '../../board/components/ThemeSwitch'
import {
  LOGIN_LOCK_MINUTES,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type LoginError,
} from '../login-model'

const FAILURE_MESSAGES: Record<LoginError, string> = {
  invalid: 'That password isn’t right.',
  locked: `Too many tries. Wait ${LOGIN_LOCK_MINUTES} minutes, then try again.`,
  setup: `No password has been set up yet, or it’s under ${MIN_PASSWORD_LENGTH} characters.`,
  unavailable: 'Something went wrong on the server. Try again.',
}

interface LoginViewProps {
  readonly error?: LoginError
}

export function LoginView({ error }: LoginViewProps) {
  return (
    <main className="board-page">
      <header className="masthead">
        <h1>Work in Hand</h1>
        <div className="masthead-meta">
          <ThemeSwitch />
        </div>
      </header>

      <form className="login-form" method="post" action="/api/login">
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
        />
        <button type="submit">Log in</button>
        <p className="login-error" role="alert">
          {error ? FAILURE_MESSAGES[error] : null}
        </p>
      </form>
    </main>
  )
}

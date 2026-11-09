import { Link, useLocation } from '@tanstack/react-router'
import { ThemeSwitch } from './ThemeSwitch'

export function NotFoundView() {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <main className="board-page">
      <header className="masthead">
        <h1>Page not found</h1>
        <div className="masthead-meta">
          <ThemeSwitch />
        </div>
      </header>

      <section className="not-found">
        <p className="not-found-code">404</p>
        <div className="not-found-body">
          <p className="not-found-message">
            There’s nothing at this address. It may have moved, or there may be
            a typo in it.
          </p>
          <p className="not-found-path">
            <code>{pathname}</code>
          </p>
          <nav className="not-found-links" aria-label="Where to go next">
            <Link to="/" className="not-found-home">
              Back to the board
            </Link>
            <Link to="/history" className="history-link">
              History
            </Link>
          </nav>
        </div>
      </section>
    </main>
  )
}

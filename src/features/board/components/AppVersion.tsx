import { APP_VERSION } from '../../../lib/app-version'

/** A small stamp in the bottom-right corner, so you can tell which build is running. */
export function AppVersion() {
  return (
    <p className="app-version" aria-label={`Version ${APP_VERSION}`}>
      v{APP_VERSION}
    </p>
  )
}

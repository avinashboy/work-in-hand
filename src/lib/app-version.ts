// Only `version` is imported, so the rest of package.json stays out of the bundle.
import { version } from '../../package.json'

/** The app's version. Its history is in version.md at the project root. */
export const APP_VERSION: string = version

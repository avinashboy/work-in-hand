export const THEME_IDS = ['light', 'dark'] as const

export type Theme = (typeof THEME_IDS)[number]

const STORAGE_KEY = 'board-theme'
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)'
const THEME_CHANGE_EVENT = 'board-theme-change'

/**
 * Inlined in <head> so the saved theme is on the page before the first paint.
 * It has to stand alone: nothing from this module exists yet when it runs.
 */
export const THEME_INIT_SCRIPT = `(function () {
  var theme;
  try { theme = localStorage.getItem(${JSON.stringify(STORAGE_KEY)}); } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)}).matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();`

function parseTheme(value: string | null | undefined): Theme | null {
  return THEME_IDS.find((id) => id === value) ?? null
}

function readStoredTheme(): Theme | null {
  try {
    return parseTheme(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null // Storage can be blocked; the system setting takes over.
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

export function getTheme(): Theme {
  return (
    parseTheme(document.documentElement.dataset.theme) ??
    readStoredTheme() ??
    getSystemTheme()
  )
}

/** The server can't know the theme; the first client render corrects it. */
export function getServerTheme(): Theme {
  return 'light'
}

export function chooseTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage can be blocked; the theme still applies until the page closes.
  }
  applyTheme(theme)
}

export function subscribeToTheme(listener: () => void): () => void {
  const systemScheme = window.matchMedia(DARK_SCHEME_QUERY)
  const resync = () => applyTheme(readStoredTheme() ?? getSystemTheme())

  window.addEventListener(THEME_CHANGE_EVENT, listener)
  window.addEventListener('storage', resync)
  systemScheme.addEventListener('change', resync)

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, listener)
    window.removeEventListener('storage', resync)
    systemScheme.removeEventListener('change', resync)
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THEME_INIT_SCRIPT,
  chooseTheme,
  getServerTheme,
  getTheme,
  subscribeToTheme,
} from './board-theme'
import { BOARD_LOGO_DATA_URLS } from '../brand/board-logo'

const STORAGE_KEY = 'board-theme'

type ChangeListener = () => void

function stubSystemTheme(initial: 'light' | 'dark') {
  const listeners = new Set<ChangeListener>()
  const media = {
    matches: initial === 'dark',
    addEventListener: (_: string, listener: ChangeListener) => {
      listeners.add(listener)
    },
    removeEventListener: (_: string, listener: ChangeListener) => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal('matchMedia', () => media)
  window.matchMedia = (() => media) as unknown as typeof window.matchMedia

  return {
    listenerCount: () => listeners.size,
    change: (next: 'light' | 'dark') => {
      media.matches = next === 'dark'
      listeners.forEach((listener) => listener())
    },
  }
}

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)()
}

function pageTheme() {
  return document.documentElement.dataset.theme
}

function tabIcon() {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href')
}

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  document.head.innerHTML = `<link rel="icon" href="${BOARD_LOGO_DATA_URLS.light}">`
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('script that runs before the first paint', () => {
  it('uses the saved choice over the system setting', () => {
    stubSystemTheme('dark')
    window.localStorage.setItem(STORAGE_KEY, 'light')

    runInitScript()

    expect(pageTheme()).toBe('light')
  })

  it('follows the system setting when nothing is saved', () => {
    stubSystemTheme('dark')

    runInitScript()

    expect(pageTheme()).toBe('dark')
  })

  it('ignores a saved value that is not a theme', () => {
    stubSystemTheme('light')
    window.localStorage.setItem(STORAGE_KEY, '"><script>')

    runInitScript()

    expect(pageTheme()).toBe('light')
  })

  it('shows the dark tab icon on a dark page', () => {
    stubSystemTheme('dark')

    runInitScript()

    expect(tabIcon()).toBe(BOARD_LOGO_DATA_URLS.dark)
  })

  it('keeps the light tab icon on a light page', () => {
    stubSystemTheme('light')

    runInitScript()

    expect(tabIcon()).toBe(BOARD_LOGO_DATA_URLS.light)
  })

  it('still sets a theme when storage is blocked', () => {
    stubSystemTheme('dark')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    runInitScript()

    expect(pageTheme()).toBe('dark')
  })
})

describe('getTheme', () => {
  it('reports the theme already on the page', () => {
    stubSystemTheme('light')
    document.documentElement.dataset.theme = 'dark'

    expect(getTheme()).toBe('dark')
  })

  it('falls back to the system setting when the page has no theme', () => {
    stubSystemTheme('dark')

    expect(getTheme()).toBe('dark')
  })

  it('renders as light on the server', () => {
    expect(getServerTheme()).toBe('light')
  })
})

describe('chooseTheme', () => {
  it('changes the page and remembers the choice', () => {
    stubSystemTheme('light')

    chooseTheme('dark')

    expect(pageTheme()).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('switches the tab icon with the theme, both ways', () => {
    stubSystemTheme('light')

    chooseTheme('dark')
    expect(tabIcon()).toBe(BOARD_LOGO_DATA_URLS.dark)

    chooseTheme('light')
    expect(tabIcon()).toBe(BOARD_LOGO_DATA_URLS.light)
  })

  it('switches every tab icon link, since hydration can leave a second copy that the browser shows', () => {
    stubSystemTheme('light')
    document.head.innerHTML += `<link rel="icon" href="${BOARD_LOGO_DATA_URLS.light}">`
    const allIcons = () =>
      [...document.querySelectorAll('link[rel="icon"]')].map((link) => link.getAttribute('href'))

    chooseTheme('dark')
    expect(allIcons()).toEqual([BOARD_LOGO_DATA_URLS.dark, BOARD_LOGO_DATA_URLS.dark])

    window.localStorage.setItem(STORAGE_KEY, 'light')
    runInitScript()
    expect(allIcons()).toEqual([BOARD_LOGO_DATA_URLS.light, BOARD_LOGO_DATA_URLS.light])
  })

  it('still changes the page when storage is blocked', () => {
    stubSystemTheme('light')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    chooseTheme('dark')

    expect(pageTheme()).toBe('dark')
  })
})

describe('subscribeToTheme', () => {
  it('tells the listener about a new choice', () => {
    stubSystemTheme('light')
    const listener = vi.fn()
    const unsubscribe = subscribeToTheme(listener)

    chooseTheme('dark')

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('follows a system change when nothing was chosen', () => {
    const system = stubSystemTheme('light')
    const listener = vi.fn()
    const unsubscribe = subscribeToTheme(listener)

    system.change('dark')

    expect(pageTheme()).toBe('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('keeps the chosen theme when the system changes', () => {
    const system = stubSystemTheme('light')
    chooseTheme('light')
    const unsubscribe = subscribeToTheme(vi.fn())

    system.change('dark')

    expect(pageTheme()).toBe('light')
    unsubscribe()
  })

  it('picks up a choice made in another tab', () => {
    stubSystemTheme('light')
    const unsubscribe = subscribeToTheme(vi.fn())
    window.localStorage.setItem(STORAGE_KEY, 'dark')

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    expect(pageTheme()).toBe('dark')
    unsubscribe()
  })

  it('stops listening after unsubscribing', () => {
    const system = stubSystemTheme('light')
    const listener = vi.fn()
    const unsubscribe = subscribeToTheme(listener)

    unsubscribe()
    chooseTheme('dark')

    expect(listener).not.toHaveBeenCalled()
    expect(system.listenerCount()).toBe(0)
  })
})

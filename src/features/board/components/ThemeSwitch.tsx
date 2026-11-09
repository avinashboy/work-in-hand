import { useSyncExternalStore } from 'react'
import {
  THEME_IDS,
  chooseTheme,
  getServerTheme,
  getTheme,
  subscribeToTheme,
  type Theme,
} from '../board-theme'

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
}

export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme)

  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      {THEME_IDS.map((option) => (
        <button
          key={option}
          type="button"
          className="theme-option"
          data-option={option}
          aria-pressed={theme === option}
          onClick={() => chooseTheme(option)}
        >
          {THEME_LABELS[option]}
        </button>
      ))}
    </div>
  )
}

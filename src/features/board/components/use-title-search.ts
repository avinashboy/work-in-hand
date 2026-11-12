import { useEffect, useRef, useState } from 'react'
import type { HistoryFilter } from '../history-filter'

/** How long typing has to pause before History searches by itself. */
export const TYPING_PAUSE_MS = 300

export interface ApplyOptions {
  /** Swap the current address instead of adding one, so Back skips each keystroke. */
  readonly replace?: boolean
}

export type ApplyFilter = (filter: HistoryFilter, options?: ApplyOptions) => void

export interface TitleSearch {
  readonly text: string
  readonly type: (value: string) => void
  /** Call when the form applies the words itself (Search, a new range), so no late search follows. */
  readonly settle: (search: string) => void
  readonly clear: () => void
}

/**
 * The Title box's words, searched by themselves once typing pauses. The box
 * keeps its own text, so a search that lands mid-word doesn't undo typing,
 * while Back and Forward still bring the address's words into the box.
 */
export function useTitleSearch(filter: HistoryFilter, onApply: ApplyFilter): TitleSearch {
  const [text, setText] = useState(filter.search)
  const applied = useRef(filter.search)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => cancel, [])

  // Words in the address that this box didn't send came from Back or Forward.
  useEffect(() => {
    if (filter.search === applied.current) return
    applied.current = filter.search
    setText(filter.search)
  }, [filter.search])

  const type = (value: string) => {
    setText(value)
    cancel()
    timer.current = setTimeout(() => {
      timer.current = null
      const search = value.trim()
      if (search === applied.current) return
      applied.current = search
      onApply({ ...filter, search }, { replace: true })
    }, TYPING_PAUSE_MS)
  }

  const settle = (search: string) => {
    cancel()
    applied.current = search
  }

  const clear = () => {
    settle('')
    setText('')
  }

  return { text, type, settle, clear }
}

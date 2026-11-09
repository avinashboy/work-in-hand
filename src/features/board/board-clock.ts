import { useSyncExternalStore } from 'react'

const TICK_MS = 1000

// One timer however many cards are showing a time.
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let now: number | null = null

function tick(): void {
  now = Date.now()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    now = Date.now()
    timer = setInterval(tick, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    clearInterval(timer)
    now = null
  }
}

/** The current time, ticking every second. Null until running in the browser. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  )
}

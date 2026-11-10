import { useSyncExternalStore } from 'react'

const subscribeToNothing = () => () => {}

/** False on the server and during hydration, true afterwards in the browser. */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}

import { useSyncExternalStore } from 'react'
import { formatTimestamp } from '../board-time'

const subscribeToNothing = () => () => {}

function useHasHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}

interface TimestampProps {
  readonly value: number
}

/**
 * The server can't know the viewer's time zone, so the first render is in UTC
 * (matching on both sides) and switches to local time once in the browser.
 */
export function Timestamp({ value }: TimestampProps) {
  const hasHydrated = useHasHydrated()

  return (
    <time dateTime={new Date(value).toISOString()}>
      {hasHydrated
        ? formatTimestamp(value)
        : `${formatTimestamp(value, 'UTC')} UTC`}
    </time>
  )
}

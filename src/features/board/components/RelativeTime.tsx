import { useNow } from '../board-clock'
import { formatRelativeTime } from '../board-time'

// Holds the space a real value will take, so cards don't jump when it appears.
const PLACEHOLDER = '00 minutes ago'

interface RelativeTimeProps {
  readonly value: number
}

export function RelativeTime({ value }: RelativeTimeProps) {
  const now = useNow()

  if (now === null) {
    return (
      <span className="relative-time" data-pending="true" aria-hidden="true">
        {PLACEHOLDER}
      </span>
    )
  }

  return (
    <time className="relative-time" dateTime={new Date(value).toISOString()}>
      {formatRelativeTime(value, now)}
    </time>
  )
}

import { useEffect, useId, useRef, useState } from 'react'
import { RelativeTime } from './RelativeTime'
import { Timestamp } from './Timestamp'

interface CardTimeProps {
  readonly label: string
  readonly value: number
}

/**
 * "Added 13 minutes ago", with the exact time on hover or keyboard focus (CSS)
 * and on touch (here, because a touch screen has no hover).
 */
export function CardTime({ label, value }: CardTimeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const lastPointerType = useRef<string | null>(null)
  const tipId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const closeOnOutsideTouch = (event: PointerEvent) => {
      if (event.target instanceof Node && triggerRef.current?.contains(event.target)) {
        return
      }
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideTouch)
    return () => document.removeEventListener('pointerdown', closeOnOutsideTouch)
  }, [isOpen])

  return (
    <span className="task-time" data-open={isOpen}>
      {label}{' '}
      <button
        ref={triggerRef}
        type="button"
        className="time-trigger"
        aria-describedby={tipId}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType
        }}
        onClick={() => {
          if (lastPointerType.current === 'touch') setIsOpen((wasOpen) => !wasOpen)
        }}
      >
        <RelativeTime value={value} />
      </button>
      <span id={tipId} role="tooltip" className="time-tip">
        <Timestamp value={value} />
      </span>
    </span>
  )
}

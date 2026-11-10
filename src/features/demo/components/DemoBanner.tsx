import { DEMO_CARD_LIFETIME_MINUTES, DEMO_MAX_CARDS, DEMO_VISITOR_LOG_DAYS } from '../demo-config'

interface DemoBannerProps {
  /** Cards that can still be added, or null while that isn't known yet. */
  readonly roomLeft: number | null
}

function roomText(roomLeft: number | null): string | null {
  if (roomLeft === null || roomLeft === 0) return null
  return roomLeft === 1 ? '1 card left.' : `${roomLeft} cards left.`
}

export function DemoBanner({ roomLeft }: DemoBannerProps) {
  const room = roomText(roomLeft)

  return (
    <div className="demo-banner-stack">
      <p className="demo-banner">
        <strong>Public demo.</strong> Anyone can see and change this board, so don't
        add anything private. Cards are deleted {DEMO_CARD_LIFETIME_MINUTES} minutes
        after they're added, and there's room for {DEMO_MAX_CARDS} at a time, counting
        History.{room ? ` ${room}` : null}
      </p>
      <p className="demo-banner demo-privacy">
        <strong>For safety,</strong> each visit and change is logged with a browser
        fingerprint, your device, system and browser, the time, and any text you
        write. The log is kept apart from the board and deleted after{' '}
        {DEMO_VISITOR_LOG_DAYS} days.
      </p>
      {/* A live region, so screen readers hear when adding turns off. */}
      <p className="demo-full" role="status">
        {roomLeft === 0 ? (
          <>
            <strong>The board is full.</strong> All {DEMO_MAX_CARDS} cards are in
            use, so adding cards is turned off. It turns back on by itself when the
            oldest card is deleted, within {DEMO_CARD_LIFETIME_MINUTES} minutes.
          </>
        ) : null}
      </p>
    </div>
  )
}

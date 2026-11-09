import { DEMO_CARD_LIFETIME_MINUTES, DEMO_MAX_CARDS } from '../demo-config'

export function DemoBanner() {
  return (
    <p className="demo-banner">
      <strong>Public demo.</strong> Anyone can see and change this board, so don't
      add anything private. Cards are deleted {DEMO_CARD_LIFETIME_MINUTES} minutes
      after they're added, and there's room for {DEMO_MAX_CARDS} at a time.
    </p>
  )
}

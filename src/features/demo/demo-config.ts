const MINUTE_MS = 60 * 1000

/** Fixed when the app is built: only `npm run deploy:demo` turns this on. */
export const IS_DEMO = import.meta.env.MODE === 'demo'

export const DEMO_CARD_LIFETIME_MINUTES = 10
export const DEMO_CARD_LIFETIME_MS = DEMO_CARD_LIFETIME_MINUTES * MINUTE_MS

/** Across all visitors, counting cards on the board and in History. */
export const DEMO_MAX_CARDS = 20

/**
 * Free-plan limits are shared with the private site, and one save rewrites
 * every card's row. This keeps the demo well under the daily row-write limit.
 */
export const DEMO_MAX_WRITES_PER_DAY = 1000

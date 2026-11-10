const MINUTE_MS = 60 * 1000

/** Fixed when the app is built: only `npm run deploy:demo` turns this on. */
export const IS_DEMO = import.meta.env.MODE === 'demo'

export const DEMO_CARD_LIFETIME_MINUTES = 10
export const DEMO_CARD_LIFETIME_MS = DEMO_CARD_LIFETIME_MINUTES * MINUTE_MS

/**
 * Across all visitors, counting cards on the board and in History. Once it is
 * reached, the page stops offering to add cards until older ones expire.
 */
export const DEMO_MAX_CARDS = 9

/**
 * Free-plan limits are shared with the private site, and one save rewrites
 * every card's row. This keeps the demo well under the daily row-write limit.
 */
export const DEMO_MAX_WRITES_PER_DAY = 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** How long the visitor log keeps a row: about one month. */
export const DEMO_VISITOR_LOG_DAYS = 30
export const DEMO_VISITOR_LOG_RETENTION_MS = DEMO_VISITOR_LOG_DAYS * DAY_MS

/**
 * Most log rows written in one day. Log writes share the free plan's row-write
 * quota with the private site, so a busy or hostile visitor can't use it up.
 */
export const DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY = 2000

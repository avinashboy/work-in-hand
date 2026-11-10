import type { SqlDatabase } from '../../lib/sql-database'
import type { ArchiveActor } from '../board/board-model'
import { recordArchiveActor } from '../board/board-archive-actors.server'

/**
 * Local testing only: 55 finished cards, at different times of day, so
 * History's search, date filters and pages have something to show. 20 are
 * from the last 13 months, counted back from today; 35 have fixed dates from
 * 2022 to mid-2025. Only reachable from `npm run dev` (see dev-routes).
 */

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

type MockHow = ArchiveActor | 'after-24-hours'

interface MockCardBase {
  readonly title: string
  /** How long it took from being added to reaching Done. */
  readonly workDays: number
  readonly how: MockHow
  readonly notes?: string
}

/** Recent cards count back from today (fractions vary the time of day); older ones have a fixed UTC time. */
export type MockHistoryCard = MockCardBase &
  ({ readonly archivedDaysAgo: number } | { readonly archivedOn: string })

/** When this mock card moved to History. */
export function mockArchivedAt(card: MockHistoryCard, now: number): number {
  return 'archivedOn' in card ? Date.parse(card.archivedOn) : Math.round(now - card.archivedDaysAgo * DAY_MS)
}

const BUTTON: MockHow = { kind: 'board', client: null }
const API: MockHow = { kind: 'api', client: null }
const CLAUDE: MockHow = { kind: 'agent', client: 'Claude Desktop' }
const CURSOR: MockHow = { kind: 'agent', client: 'Cursor' }
const AUTO: MockHow = 'after-24-hours'

const RECENT_HISTORY: readonly MockHistoryCard[] = [
  { title: 'Send the October invoice reminders', archivedDaysAgo: 0.1, workDays: 2, how: BUTTON },
  { title: 'Review the pricing page copy', archivedDaysAgo: 1.4, workDays: 3.5, how: CLAUDE },
  { title: 'Fix the login redirect loop', archivedDaysAgo: 3.2, workDays: 1.2, how: AUTO, notes: 'Only happened on Safari.' },
  { title: 'Update the onboarding emails', archivedDaysAgo: 6.7, workDays: 5, how: API },
  { title: 'Review pull request for search filters', archivedDaysAgo: 11.5, workDays: 0.6, how: CURSOR },
  { title: 'Book the team offsite venue', archivedDaysAgo: 18.3, workDays: 9, how: BUTTON },
  { title: 'Export the Q3 invoice report', archivedDaysAgo: 26.8, workDays: 2.3, how: AUTO },
  { title: 'Plan the November newsletter', archivedDaysAgo: 41.2, workDays: 6, how: CLAUDE },
  { title: 'Clean up unused feature flags', archivedDaysAgo: 58.6, workDays: 4.4, how: BUTTON },
  { title: 'Review the accessibility audit', archivedDaysAgo: 76.9, workDays: 7.1, how: API, notes: 'Forms need labels.' },
  { title: 'Rebuild the invoice PDF template', archivedDaysAgo: 97.3, workDays: 12, how: AUTO },
  { title: 'Interview two support candidates', archivedDaysAgo: 121.5, workDays: 8, how: BUTTON },
  { title: 'Archive old customer tickets', archivedDaysAgo: 143.8, workDays: 1, how: CURSOR },
  { title: 'Write the summer release notes', archivedDaysAgo: 168.2, workDays: 3, how: CLAUDE },
  { title: 'Review the vendor contract', archivedDaysAgo: 199.4, workDays: 10, how: BUTTON },
  { title: 'Move backups to the new bucket', archivedDaysAgo: 233.7, workDays: 2.8, how: AUTO },
  { title: 'Draft the yearly security checklist', archivedDaysAgo: 268.1, workDays: 14, how: API },
  { title: 'Prepare the investor update', archivedDaysAgo: 301.6, workDays: 4, how: BUTTON },
  { title: 'Refresh the product screenshots', archivedDaysAgo: 339.9, workDays: 1.7, how: CLAUDE },
  { title: 'Close the 2025 invoice batch', archivedDaysAgo: 388.4, workDays: 5.5, how: AUTO },
]

function older(title: string, archivedOn: string, workDays: number, how: MockHow, notes?: string): MockHistoryCard {
  return { title, archivedOn, workDays, how, ...(notes ? { notes } : {}) }
}

const OLDER_HISTORY: readonly MockHistoryCard[] = [
  // 2025, before the recent cards
  older('Renew the SSL certificates', '2025-09-22T08:15:00Z', 1, AUTO),
  older('Review the Q2 support metrics', '2025-08-30T16:40:00Z', 3, CLAUDE),
  older('Migrate the blog to the new host', '2025-08-04T11:05:00Z', 9, BUTTON),
  older('Send the July invoice reminders', '2025-07-15T09:30:00Z', 2, API),
  older('Fix broken links in the help centre', '2025-06-27T19:55:00Z', 1.5, CURSOR),
  older('Plan the summer team day', '2025-05-19T13:20:00Z', 6, BUTTON),
  older('Translate the pricing page into Spanish', '2025-04-08T07:45:00Z', 5, AUTO, 'Checked by a native speaker.'),
  older('Review the cookie banner wording', '2025-02-25T15:10:00Z', 2, CLAUDE),
  older('Close the 2024 invoice batch', '2025-01-14T10:00:00Z', 4, BUTTON),
  // 2024
  older('Run the yearly backup restore test', '2024-12-09T22:30:00Z', 1, AUTO),
  older('Write the 2024 year in review', '2024-11-21T14:05:00Z', 7, BUTTON),
  older('Upgrade the database to the new version', '2024-10-03T03:40:00Z', 3, API, 'Done overnight to avoid traffic.'),
  older('Review the onboarding survey results', '2024-08-26T12:25:00Z', 4, CURSOR),
  older('Redesign the invoice email', '2024-07-11T17:50:00Z', 8, CLAUDE),
  older('Set up the status page', '2024-05-30T09:15:00Z', 2.5, BUTTON),
  older('Audit unused cloud resources', '2024-04-16T20:35:00Z', 3, AUTO),
  older('Prepare the spring product launch', '2024-03-04T08:00:00Z', 12, BUTTON),
  older('Review the 2023 security audit', '2024-01-22T11:45:00Z', 5, API),
  // 2023
  older('Move the mailing list to a new provider', '2023-12-12T16:20:00Z', 6, BUTTON),
  older('Send the November invoice reminders', '2023-11-28T09:05:00Z', 1, AUTO),
  older('Fix the slow search on mobile', '2023-10-17T21:10:00Z', 4, CURSOR),
  older('Review the partner agreement', '2023-09-05T13:35:00Z', 9, BUTTON),
  older('Record the product tour video', '2023-07-24T10:50:00Z', 3, CLAUDE),
  older('Clean up the old analytics events', '2023-06-13T18:15:00Z', 2, AUTO),
  older('Hire a part-time designer', '2023-05-02T12:00:00Z', 20, BUTTON, 'Started in June.'),
  older('Add dark mode to the dashboard', '2023-03-20T15:30:00Z', 10, API),
  older('Close the 2022 invoice batch', '2023-01-31T09:40:00Z', 3, BUTTON),
  // 2022
  older('Plan the 2023 roadmap', '2022-12-15T14:00:00Z', 8, BUTTON),
  older('Review the yearly hosting bill', '2022-11-08T10:25:00Z', 1, AUTO),
  older('Launch the referral programme', '2022-09-27T16:45:00Z', 14, CLAUDE),
  older('Replace the old contact form', '2022-08-10T07:55:00Z', 2, BUTTON),
  older('Write the first help centre articles', '2022-06-21T19:20:00Z', 6, API),
  older('Set up the first invoice template', '2022-05-03T11:10:00Z', 2, AUTO),
  older('Choose a name for the product', '2022-03-14T13:30:00Z', 5, BUTTON, 'Shortlist of five, picked by vote.'),
  older('Register the company domain', '2022-01-18T09:00:00Z', 0.5, CURSOR),
]

export const MOCK_HISTORY: readonly MockHistoryCard[] = [...RECENT_HISTORY, ...OLDER_HISTORY]

function mockId(index: number): string {
  return `mock-${String(index + 1).padStart(2, '0')}`
}

function insertCard(db: SqlDatabase, card: MockHistoryCard, index: number, now: number): boolean {
  const id = mockId(index)
  const isAutomatic = card.how === 'after-24-hours'
  const archivedAt = mockArchivedAt(card, now)
  // Automatic moves happen exactly 24 hours after Done; others a few hours after.
  const doneAt = archivedAt - (isAutomatic ? DAY_MS : (2 + (index % 5)) * HOUR_MS)
  const createdAt = Math.round(doneAt - card.workDays * DAY_MS)
  const startedAt = Math.round(createdAt + (doneAt - createdAt) * 0.4)

  const added = db.run(
    `INSERT OR IGNORE INTO tasks
       (id, title, column_id, position, created_at, moved_at, done_at, archived_at, archive_reason)
     VALUES (?, ?, 'done', 0, ?, ?, ?, ?, ?)`,
    id,
    card.title,
    createdAt,
    doneAt,
    doneAt,
    archivedAt,
    isAutomatic ? 'expired' : 'confirmed',
  )
  if (added === 0) return false

  const moves = [
    ['backlog', createdAt],
    ['doing', startedAt],
    ['done', doneAt],
  ] as const
  moves.forEach(([columnId, at]) =>
    db.run('INSERT INTO task_moves (task_id, column_id, at) VALUES (?, ?, ?)', id, columnId, at),
  )
  if (card.notes) db.run('INSERT INTO task_notes (task_id, notes) VALUES (?, ?)', id, card.notes)
  if (card.how !== 'after-24-hours') recordArchiveActor(db, id, card.how)
  return true
}

const MOCK_ID_PATTERN = 'mock-%'
const MOCK_TABLES = ['task_moves', 'task_notes', 'task_edits', 'task_archive_actors'] as const

/** Deletes every mock card and its timeline. Real cards never have a `mock-` id. */
export function removeMockHistory(db: SqlDatabase): number {
  return db.transaction(() => {
    const ids = db
      .query('SELECT id FROM tasks WHERE id LIKE ?', MOCK_ID_PATTERN)
      .map((row) => String(row.id))
    MOCK_TABLES.forEach((table) => db.run(`DELETE FROM ${table} WHERE task_id LIKE ?`, MOCK_ID_PATTERN))
    db.run('DELETE FROM tasks WHERE id LIKE ?', MOCK_ID_PATTERN)
    return ids.length
  })
}

/** Adds the mock cards straight into History. Safe to run twice: returns how many were new. */
export function insertMockHistory(db: SqlDatabase, now: number): number {
  return db.transaction(
    () => MOCK_HISTORY.filter((card, index) => insertCard(db, card, index, now)).length,
  )
}

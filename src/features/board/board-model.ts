import { z } from 'zod'
import { IS_SAFE_TEXT_REQUIRED, SAFE_TEXT_ERROR, SAFE_TEXT_PATTERN } from './safe-text'

export const COLUMN_IDS = ['backlog', 'doing', 'review', 'done'] as const
export const DONE_COLUMN_ID = 'done'
export const MAX_TITLE_LENGTH = 120
export const MAX_NOTES_LENGTH = 5000
export const MAX_TASKS_ON_BOARD = 200
export const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000
/** How many History cards a page can show. The first is the default. */
export const ARCHIVE_PAGE_SIZES = [20, 30, 40, 50] as const
export type ArchivePageSize = (typeof ARCHIVE_PAGE_SIZES)[number]
export const ARCHIVE_PAGE_SIZE: ArchivePageSize = ARCHIVE_PAGE_SIZES[0]

const MAX_ID_LENGTH = 64
const TASK_ID_BYTES = 16
const MAX_TASK_INDEX = MAX_TASKS_ON_BOARD
const MAX_ARCHIVE_PAGE = 1_000_000

const columnIdSchema = z.enum(COLUMN_IDS)
const timestampSchema = z.number().int().positive()
// Task and column ids share one namespace in dnd-kit, so they must not overlap.
export const taskIdSchema = z
  .string()
  .min(1)
  .max(MAX_ID_LENGTH)
  .regex(/^[A-Za-z0-9-]+$/)
  .refine((id) => !COLUMN_IDS.some((columnId) => columnId === id))

/** Uses getRandomValues because randomUUID is missing on plain HTTP origins. */
export function createTaskId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TASK_ID_BYTES))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

/** On the public demo, text must also pass the safe-text pattern. */
function withSafeText(schema: z.ZodString): z.ZodString {
  return IS_SAFE_TEXT_REQUIRED ? schema.regex(SAFE_TEXT_PATTERN, SAFE_TEXT_ERROR) : schema
}

export const taskTitleSchema = withSafeText(z.string().trim().min(1).max(MAX_TITLE_LENGTH))
export const taskNotesSchema = withSafeText(z.string().max(MAX_NOTES_LENGTH))
export const archivePageSchema = z.number().int().min(1).max(MAX_ARCHIVE_PAGE)
export const archivePageSizeSchema = z.literal(ARCHIVE_PAGE_SIZES)

/**
 * Commands are the only way a board changes. The client replays pending ones
 * over its cached board and the server applies them for real, so both sides
 * share one reducer. Each command is idempotent: replaying it is harmless.
 *
 * `at` lets the client show a time immediately. The server always replaces it
 * with its own clock, so stored timestamps never come from the browser.
 */
export const boardCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('move'),
    taskId: taskIdSchema,
    toColumnId: columnIdSchema,
    toIndex: z.number().int().min(0).max(MAX_TASK_INDEX),
    at: timestampSchema,
  }),
  z.object({
    type: z.literal('create'),
    taskId: taskIdSchema,
    columnId: columnIdSchema,
    title: taskTitleSchema,
    notes: taskNotesSchema.optional(),
    at: timestampSchema,
  }),
  z.object({
    type: z.literal('set-title'),
    taskId: taskIdSchema,
    title: taskTitleSchema,
  }),
  z.object({
    type: z.literal('set-notes'),
    taskId: taskIdSchema,
    notes: taskNotesSchema,
  }),
  z.object({
    type: z.literal('delete'),
    taskId: taskIdSchema,
  }),
  z.object({
    type: z.literal('archive'),
    taskId: taskIdSchema,
  }),
])

export type ColumnId = z.infer<typeof columnIdSchema>
export type BoardCommand = z.infer<typeof boardCommandSchema>
export type ArchiveReason = 'confirmed' | 'expired'

/** Who moved a card to History: the board's button, an app on the REST API, or an AI agent over MCP. */
export const ARCHIVE_ACTOR_KINDS = ['board', 'api', 'agent'] as const
export type ArchiveActorKind = (typeof ARCHIVE_ACTOR_KINDS)[number]

export interface ArchiveActor {
  readonly kind: ArchiveActorKind
  /** The app or agent's name, such as "Claude Desktop", when it is known. */
  readonly client: string | null
}

export const BOARD_ARCHIVE_ACTOR: ArchiveActor = { kind: 'board', client: null }

export interface Task {
  readonly id: string
  readonly title: string
  readonly notes: string
  readonly createdAt: number
  /** When it landed in its current column. Equals createdAt until it moves. */
  readonly movedAt: number
  readonly doneAt: number | null
}

export interface TaskMove {
  readonly columnId: ColumnId
  readonly at: number
}

export const TASK_EDIT_KINDS = ['title', 'notes-added', 'notes-changed', 'notes-removed'] as const
export type TaskEditKind = (typeof TASK_EDIT_KINDS)[number]

/** A saved change to a card's title or notes, and the column it was in at the time. */
export interface TaskEdit {
  readonly kind: TaskEditKind
  readonly columnId: ColumnId
  readonly at: number
}

export interface Column {
  readonly id: ColumnId
  readonly title: string
  readonly tasks: readonly Task[]
}

export interface Board {
  readonly columns: readonly Column[]
}

/** The board as the server sends it. */
export interface BoardSnapshot extends Board {
  /**
   * Demo only: cards counted towards its cap, including History. Sent with
   * every board so the page needs no extra request to know. Null elsewhere.
   */
  readonly demoCardCount: number | null
}

export interface ArchivedTask {
  readonly id: string
  readonly title: string
  readonly notes: string
  readonly createdAt: number
  readonly doneAt: number
  readonly archivedAt: number
  readonly reason: ArchiveReason
  /** Null when it moved by itself after 24 hours, or was archived before this was recorded. */
  readonly archivedBy: ArchiveActor | null
  /** Every column it landed in, oldest first. */
  readonly moves: readonly TaskMove[]
  /** Every title and notes change, oldest first. */
  readonly edits: readonly TaskEdit[]
}

export interface ArchivePage {
  readonly tasks: readonly ArchivedTask[]
  readonly page: number
  readonly pageSize: ArchivePageSize
  readonly pageCount: number
  readonly total: number
}

export const COLUMN_TITLES: Readonly<Record<ColumnId, string>> = {
  backlog: 'Backlog',
  doing: 'In progress',
  review: 'In review',
  done: 'Done',
}

const SEED_TASKS: Readonly<Record<ColumnId, readonly (readonly [string, string])[]>> = {
  backlog: [
    ['seed-a1f3', 'Draft the onboarding checklist'],
    ['seed-7c20', 'Audit colour contrast on forms'],
    ['seed-e94b', 'Collect feedback from the beta group'],
  ],
  doing: [
    ['seed-3d6a', 'Rebuild the invoice export'],
    ['seed-b508', 'Write release notes for 2.4'],
  ],
  review: [['seed-40ce', 'Migrate search to the new index']],
  done: [],
}

export function createSeedBoard(createdAt: number): Board {
  return {
    columns: COLUMN_IDS.map((id) => ({
      id,
      title: COLUMN_TITLES[id],
      tasks: SEED_TASKS[id].map(([taskId, title]) => ({
        id: taskId,
        title,
        notes: '',
        createdAt,
        movedAt: createdAt,
        doneAt: null,
      })),
    })),
  }
}

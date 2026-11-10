import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import type { BoardCommand } from '../board/board-model'
import { DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY, DEMO_VISITOR_LOG_RETENTION_MS } from './demo-config'
import { describeUserAgent } from './user-agent'
import type { VisitorFingerprint } from './visitor-model'

const MAX_USER_AGENT_LENGTH = 512
const MAX_MESSAGE_LENGTH = 5000
const DAY_MS = 24 * 60 * 60 * 1000

// Its own table, apart from the cards, and never shown on the page.
const VISITOR_LOG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS demo_visitor_log (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    visitor_id TEXT,
    confidence REAL,
    device TEXT NOT NULL,
    device_type TEXT NOT NULL,
    os TEXT NOT NULL,
    browser TEXT NOT NULL,
    user_agent TEXT,
    traits TEXT,
    action TEXT NOT NULL,
    task_id TEXT,
    message TEXT
  );
  CREATE INDEX IF NOT EXISTS demo_visitor_log_by_time ON demo_visitor_log (at);
`

export type VisitorAction = BoardCommand['type'] | 'visit' | 'delete-from-history'

export interface VisitorActivity {
  readonly action: VisitorAction
  readonly taskId: string | null
  /** What the person wrote, or where they moved a card. */
  readonly message: string | null
}

export interface VisitorLog {
  /** False when today's row cap is reached and nothing was written. */
  readonly record: (
    visitor: VisitorFingerprint | null,
    userAgent: string | null,
    activity: VisitorActivity,
  ) => boolean
  /** Deletes every row older than the retention period. */
  readonly deleteOld: () => void
  /** When the oldest row is due to be deleted, or null when there are none. */
  readonly nextExpiry: () => number | null
}

const oldestRowSchema = z.object({ oldest: z.number().nullable() })
const countRowSchema = z.object({ total: z.number() })

function messageFor(command: BoardCommand): string | null {
  switch (command.type) {
    case 'create':
      return command.notes ? `${command.title}\n\n${command.notes}` : command.title
    case 'set-title':
      return command.title
    case 'set-notes':
      return command.notes
    case 'move':
      return `to ${command.toColumnId}`
    case 'delete':
    case 'archive':
      return null
  }
}

export function activityForCommand(command: BoardCommand): VisitorActivity {
  return { action: command.type, taskId: command.taskId, message: messageFor(command) }
}

function trimmed(value: string | null, limit: number): string | null {
  return value === null ? null : value.slice(0, limit)
}

/** The user agent comes from the visitor: keeps line breaks and other control characters out of the log. */
export function cleanUserAgent(userAgent: string | null): string | null {
  if (userAgent === null) return null
  return trimmed(userAgent.replace(/\p{Cc}/gu, ' '), MAX_USER_AGENT_LENGTH)
}

function rowsWrittenToday(db: SqlDatabase, now: number): number {
  const dayStart = now - (now % DAY_MS)
  return countRowSchema.parse(
    db.query('SELECT COUNT(*) AS total FROM demo_visitor_log WHERE at >= ?', dayStart)[0],
  ).total
}

export function createVisitorLog({ db, now }: { db: SqlDatabase; now: () => number }): VisitorLog {
  db.script(VISITOR_LOG_SCHEMA)

  const deleteOld = () => {
    db.run('DELETE FROM demo_visitor_log WHERE at <= ?', now() - DEMO_VISITOR_LOG_RETENTION_MS)
  }

  return {
    record: (visitor, userAgent, { action, taskId, message }) => {
      deleteOld()
      if (rowsWrittenToday(db, now()) >= DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY) return false
      const device = describeUserAgent(userAgent, visitor?.traits.touchPoints ?? null)
      db.run(
        `INSERT INTO demo_visitor_log
           (at, visitor_id, confidence, device, device_type, os, browser, user_agent, traits,
            action, task_id, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        now(),
        visitor?.visitorId ?? null,
        visitor?.confidence ?? null,
        device.device,
        device.deviceType,
        device.os,
        device.browser,
        cleanUserAgent(userAgent),
        visitor ? JSON.stringify(visitor.traits) : null,
        action,
        taskId,
        trimmed(message, MAX_MESSAGE_LENGTH),
      )
      return true
    },
    deleteOld,
    nextExpiry: () => {
      const { oldest } = oldestRowSchema.parse(
        db.query('SELECT MIN(at) AS oldest FROM demo_visitor_log')[0],
      )
      return oldest === null ? null : oldest + DEMO_VISITOR_LOG_RETENTION_MS
    },
  }
}

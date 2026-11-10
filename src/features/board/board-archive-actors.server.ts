import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import { ARCHIVE_ACTOR_KINDS, type ArchiveActor } from './board-model'

// Its own table, so databases made before this was recorded need no change to `tasks`.
export const ARCHIVE_ACTORS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS task_archive_actors (
    task_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('board', 'api', 'agent')),
    client TEXT
  );
`

/** Joined onto `tasks t` by the queries that report who archived a card. */
export const JOIN_ARCHIVE_ACTORS = 'LEFT JOIN task_archive_actors a ON a.task_id = t.id'
export const SELECT_ARCHIVE_ACTOR = 'a.kind AS archived_by, a.client AS archived_by_client'

export const archiveActorColumns = {
  archived_by: z.enum(ARCHIVE_ACTOR_KINDS).nullable(),
  archived_by_client: z.string().nullable(),
}

export function toArchiveActor(row: {
  readonly archived_by: ArchiveActor['kind'] | null
  readonly archived_by_client: string | null
}): ArchiveActor | null {
  return row.archived_by === null ? null : { kind: row.archived_by, client: row.archived_by_client }
}

export function recordArchiveActor(db: SqlDatabase, taskId: string, actor: ArchiveActor): void {
  db.run(
    `INSERT INTO task_archive_actors (task_id, kind, client) VALUES (?, ?, ?)
     ON CONFLICT (task_id) DO UPDATE SET kind = excluded.kind, client = excluded.client`,
    taskId,
    actor.kind,
    actor.client,
  )
}

export function deleteArchiveActor(db: SqlDatabase, taskId: string): void {
  db.run('DELETE FROM task_archive_actors WHERE task_id = ?', taskId)
}

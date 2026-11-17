import { z } from 'zod'
import type { SqlDatabase } from '../../lib/sql-database'
import { ARCHIVE_ACTOR_KINDS, type ArchiveActor } from './board-model'

/** The tables whose rows say who made each change. */
type ActorTable = 'task_moves' | 'task_edits'

const ACTOR_KIND_COLUMN = `by_kind TEXT CHECK (by_kind IN (${ARCHIVE_ACTOR_KINDS.map((kind) => `'${kind}'`).join(', ')}))`

const columnNameSchema = z.object({ name: z.string() })

/**
 * Adds the "who" columns to a table made before they existed. Older rows keep
 * null, so their timeline shows no one rather than a guess.
 */
export function addActorColumns(db: SqlDatabase, table: ActorTable): void {
  const columns = new Set(
    db.query('SELECT name FROM pragma_table_info(?)', table).map((row) => columnNameSchema.parse(row).name),
  )
  if (!columns.has('by_kind')) db.script(`ALTER TABLE ${table} ADD COLUMN ${ACTOR_KIND_COLUMN}`)
  if (!columns.has('by_client')) db.script(`ALTER TABLE ${table} ADD COLUMN by_client TEXT`)
}

export const actorRowColumns = {
  by_kind: z.enum(ARCHIVE_ACTOR_KINDS).nullable().default(null),
  by_client: z.string().nullable().default(null),
}

export function toChangeActor(row: {
  readonly by_kind: ArchiveActor['kind'] | null
  readonly by_client: string | null
}): ArchiveActor | null {
  return row.by_kind === null ? null : { kind: row.by_kind, client: row.by_client }
}

// Copies the cards from data/board.db into data/initial-board.json. The first
// deploy starts from that file. Only reads the database, never changes it.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const SOURCE = resolve('data', 'board.db')
const TARGET = resolve('data', 'initial-board.json')

const db = new DatabaseSync(SOURCE, { readOnly: true })

const tasks = db
  .prepare(
    `SELECT id, title, column_id AS columnId, position, created_at AS createdAt,
            moved_at AS movedAt, done_at AS doneAt, archived_at AS archivedAt,
            archive_reason AS archiveReason
     FROM tasks ORDER BY position`,
  )
  .all()

const moves = db
  .prepare(
    `SELECT task_id AS taskId, column_id AS columnId, at FROM task_moves
     ORDER BY at, id`,
  )
  .all()

db.close()
writeFileSync(TARGET, `${JSON.stringify({ tasks, moves }, null, 2)}\n`)
console.log(`Exported ${tasks.length} cards to ${TARGET}`)

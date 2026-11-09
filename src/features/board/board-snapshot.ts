import { z } from 'zod'
import { COLUMN_IDS, taskIdSchema, taskTitleSchema } from './board-model'

const columnIdSchema = z.enum(COLUMN_IDS)

/** Cards exported from the old database file, imported once on first start. */
export const boardSnapshotSchema = z.object({
  tasks: z.array(
    z.object({
      id: taskIdSchema,
      title: taskTitleSchema,
      columnId: columnIdSchema,
      position: z.number().int().min(0),
      createdAt: z.number(),
      movedAt: z.number(),
      doneAt: z.number().nullable(),
      archivedAt: z.number().nullable(),
      archiveReason: z.enum(['confirmed', 'expired']).nullable(),
    }),
  ),
  moves: z.array(
    z.object({ taskId: taskIdSchema, columnId: columnIdSchema, at: z.number() }),
  ),
})

export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>

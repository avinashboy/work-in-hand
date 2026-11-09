import { DurableObject, env } from 'cloudflare:workers'
import { createDurableObjectSql } from '../../lib/durable-object-sql.server'
import type { LoginAttemptStore } from '../auth/auth-gate.server'
import { createLoginAttempts, type LoginAttempts } from '../auth/login-attempts.server'
import {
  createSeedBoard,
  type ArchivePage,
  type Board,
  type BoardCommand,
  type Task,
} from './board-model'
import {
  createBoardRepository,
  type BoardRepository,
  type NewTask,
} from './board-repository.server'
import { boardSnapshotSchema, type BoardSnapshot } from './board-snapshot'

/** One person, one board, so there is only ever one of these objects. */
const BOARD_STORE_NAME = 'board'

// Written by `npm run export-board`. Bundled into the server only, if present.
const exportedBoards = import.meta.glob('/data/initial-board.json', {
  eager: true,
  import: 'default',
})

function readExportedBoard(): BoardSnapshot | undefined {
  const [exported] = Object.values(exportedBoards)
  return exported === undefined ? undefined : boardSnapshotSchema.parse(exported)
}

export class BoardStore extends DurableObject<Cloudflare.Env> {
  private readonly repository: BoardRepository
  private readonly loginAttempts: LoginAttempts

  constructor(ctx: DurableObjectState, workerEnv: Cloudflare.Env) {
    super(ctx, workerEnv)
    const db = createDurableObjectSql(ctx.storage)
    this.repository = createBoardRepository({
      db,
      now: Date.now,
      seedBoard: createSeedBoard(Date.now()),
      loadSnapshot: readExportedBoard,
    })
    this.loginAttempts = createLoginAttempts({ db, now: Date.now })
  }

  reserveLoginAttempt(client: string): boolean {
    return this.loginAttempts.reserve(client)
  }

  clearLoginAttempts(client: string): void {
    this.loginAttempts.clear(client)
  }

  readBoard(): Board {
    return this.repository.get()
  }

  applyCommand(command: BoardCommand): Board {
    return this.repository.apply(command)
  }

  createTask(input: NewTask): Task | null {
    return this.repository.createTask(input)
  }

  listArchive(page: number): ArchivePage {
    return this.repository.listArchive(page)
  }

  deleteArchived(taskId: string): void {
    this.repository.deleteArchived(taskId)
  }
}

export function getBoardStore() {
  return env.BOARD_STORE.getByName(BOARD_STORE_NAME)
}

export function getLoginAttempts(): LoginAttemptStore {
  const store = getBoardStore()
  return {
    reserve: (client) => store.reserveLoginAttempt(client),
    clear: (client) => store.clearLoginAttempts(client),
  }
}

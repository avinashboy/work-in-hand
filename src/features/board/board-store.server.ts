import { DurableObject, env } from 'cloudflare:workers'
import { createDurableObjectSql } from '../../lib/durable-object-sql.server'
import type { LoginAttemptStore } from '../auth/auth-gate.server'
import { createLoginAttempts, type LoginAttempts } from '../auth/login-attempts.server'
import { createDemoBoard, type DemoBoard } from '../demo/demo-board.server'
import { IS_DEMO } from '../demo/demo-config'
import {
  activityForCommand,
  createVisitorLog,
  type VisitorActivity,
  type VisitorLog,
} from '../demo/visitor-log.server'
import type { VisitorFingerprint } from '../demo/visitor-model'
import {
  createSeedBoard,
  type ArchivePage,
  type Board,
  type BoardCommand,
  type BoardSnapshot,
  type Task,
} from './board-model'
import {
  createBoardRepository,
  type BoardRepository,
  type NewTask,
} from './board-repository.server'
import type { TaskPatch } from './board-task-operations.server'
import type {
  StoredTaskDetail,
  TaskChange,
  TaskListPage,
  TaskQuery,
  TaskSummary,
} from './board-task-queries.server'

/** Who made a demo request: their fingerprint, if sent, and their user agent. */
export interface DemoVisitor {
  readonly fingerprint: VisitorFingerprint | null
  readonly userAgent: string | null
}

function earliest(...times: readonly (number | null)[]): number | null {
  const known = times.filter((time): time is number => time !== null)
  return known.length === 0 ? null : Math.min(...known)
}

/** One person, one board, so there is only ever one of these objects. */
const BOARD_STORE_NAME = 'board'

export class BoardStore extends DurableObject<Cloudflare.Env> {
  private readonly repository: BoardRepository
  private readonly loginAttempts: LoginAttempts
  private readonly demo: DemoBoard | null
  private readonly visitorLog: VisitorLog | null

  constructor(ctx: DurableObjectState, workerEnv: Cloudflare.Env) {
    super(ctx, workerEnv)
    const db = createDurableObjectSql(ctx.storage)
    this.demo = IS_DEMO ? createDemoBoard({ db, now: Date.now }) : null
    this.visitorLog = IS_DEMO ? createVisitorLog({ db, now: Date.now }) : null
    this.repository =
      this.demo ??
      createBoardRepository({
        db,
        now: Date.now,
        seedBoard: createSeedBoard(Date.now()),
      })
    this.loginAttempts = createLoginAttempts({ db, now: Date.now })
  }

  /** Demo only: deletes expired cards and old visitor log rows, even with no visitors. */
  async alarm(): Promise<void> {
    this.demo?.deleteExpired()
    this.visitorLog?.deleteOld()
    await this.scheduleDemoCleanup()
  }

  /** Cards expire in minutes and log rows in a month, so an earlier time replaces a later alarm. */
  private async scheduleDemoCleanup(): Promise<void> {
    const expiry = earliest(this.demo?.nextExpiry() ?? null, this.visitorLog?.nextExpiry() ?? null)
    if (expiry === null) return
    const current = await this.ctx.storage.getAlarm()
    if (current !== null && current <= expiry) return
    await this.ctx.storage.setAlarm(expiry)
  }

  /** A failed log write mustn't undo or fail the change it describes. */
  private async logVisitor(visitor: DemoVisitor | null, activity: VisitorActivity): Promise<void> {
    if (this.visitorLog === null || visitor === null) return
    try {
      this.visitorLog.record(visitor.fingerprint, visitor.userAgent, activity)
    } catch (error) {
      console.error('Could not write the demo visitor log:', error)
    }
    // Separate, so old rows still get a cleanup alarm when a write fails.
    await this.scheduleDemoCleanup().catch((error: unknown) => {
      console.error('Could not schedule the demo cleanup:', error)
    })
  }

  /** Demo only: notes that someone opened the board. */
  async recordVisit(visitor: DemoVisitor): Promise<void> {
    await this.logVisitor(visitor, { action: 'visit', taskId: null, message: null })
  }

  reserveLoginAttempt(client: string): boolean {
    return this.loginAttempts.reserve(client)
  }

  clearLoginAttempts(client: string): void {
    this.loginAttempts.clear(client)
  }

  private snapshot(board: Board): BoardSnapshot {
    return { ...board, demoCardCount: this.demo?.countCards() ?? null }
  }

  readBoard(): BoardSnapshot {
    return this.snapshot(this.repository.get())
  }

  async applyCommand(command: BoardCommand, visitor: DemoVisitor | null = null): Promise<BoardSnapshot> {
    const board = this.repository.apply(command)
    await this.logVisitor(visitor, activityForCommand(command))
    // The change is already saved, so a failure here mustn't report it as lost.
    // Reads still clear expired cards, and the next change tries this again.
    await this.scheduleDemoCleanup().catch((error: unknown) => {
      console.error('Could not schedule the demo cleanup:', error)
    })
    return this.snapshot(board)
  }

  createTask(input: NewTask): Task | null {
    return this.repository.createTask(input)
  }

  listArchive(page: number): ArchivePage {
    return this.repository.listArchive(page)
  }

  async deleteArchived(taskId: string, visitor: DemoVisitor | null = null): Promise<void> {
    this.repository.deleteArchived(taskId)
    await this.logVisitor(visitor, { action: 'delete-from-history', taskId, message: null })
  }

  listTasks(query: TaskQuery): TaskListPage {
    return this.repository.listTasks(query)
  }

  findTask(taskId: string): StoredTaskDetail | null {
    return this.repository.findTask(taskId)
  }

  summarizeTasks(): TaskSummary {
    return this.repository.summarizeTasks()
  }

  updateTask(taskId: string, patch: TaskPatch): TaskChange {
    return this.repository.updateTask(taskId, patch)
  }

  removeTask(taskId: string): boolean {
    return this.repository.removeTask(taskId)
  }

  archiveTask(taskId: string): TaskChange {
    return this.repository.archiveTask(taskId)
  }
}

export function getBoardStore() {
  return env.BOARD_STORE.getByName(BOARD_STORE_NAME)
}

export function getTaskApiStore() {
  const store = getBoardStore()
  return {
    createTask: (input: NewTask) => store.createTask(input),
    listTasks: (query: TaskQuery) => store.listTasks(query),
    findTask: (taskId: string) => store.findTask(taskId),
    summarizeTasks: () => store.summarizeTasks(),
    updateTask: (taskId: string, patch: TaskPatch) => store.updateTask(taskId, patch),
    removeTask: (taskId: string) => store.removeTask(taskId),
    archiveTask: (taskId: string) => store.archiveTask(taskId),
  }
}

export function getLoginAttempts(): LoginAttemptStore {
  const store = getBoardStore()
  return {
    reserve: (client) => store.reserveLoginAttempt(client),
    clear: (client) => store.clearLoginAttempts(client),
  }
}

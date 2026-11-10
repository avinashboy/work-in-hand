// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openTestDatabase, type TestDatabase } from '../../lib/node-sql-database.testing'
import { DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY, DEMO_VISITOR_LOG_RETENTION_MS } from './demo-config'
import {
  activityForCommand,
  cleanUserAgent,
  createVisitorLog,
  type VisitorLog,
} from './visitor-log.server'
import type { VisitorFingerprint } from './visitor-model'

const START = Date.UTC(2026, 10, 10, 12)
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1'

const visitor: VisitorFingerprint = {
  visitorId: '0123456789abcdef0123456789abcdef',
  confidence: 0.6,
  traits: {
    platform: 'iPhone',
    timezone: 'Asia/Kolkata',
    languages: ['en-IN'],
    screen: '390x844',
    touchPoints: 5,
    cpuCores: 6,
    memoryGb: null,
    vendor: 'Apple Computer, Inc.',
  },
}

describe('demo visitor log', () => {
  let db: TestDatabase
  let time: number
  let log: VisitorLog

  function rows() {
    return db.query('SELECT * FROM demo_visitor_log ORDER BY id')
  }

  beforeEach(() => {
    db = openTestDatabase()
    time = START
    log = createVisitorLog({ db, now: () => time })
  })

  afterEach(() => db.close())

  it('stores the fingerprint, device, browser, time and message in its own table', () => {
    log.record(visitor, IPHONE, { action: 'create', taskId: 't1', message: 'Hello' })

    expect(rows()).toEqual([
      expect.objectContaining({
        at: START,
        visitor_id: visitor.visitorId,
        confidence: 0.6,
        device: 'iPhone',
        device_type: 'Phone',
        os: 'iOS 18.2',
        browser: 'Safari 18.2',
        user_agent: IPHONE,
        action: 'create',
        task_id: 't1',
        message: 'Hello',
      }),
    ])
    expect(JSON.parse(String(rows()[0].traits))).toEqual(visitor.traits)
  })

  it('still logs a visit when the browser sent no fingerprint', () => {
    log.record(null, IPHONE, { action: 'visit', taskId: null, message: null })

    expect(rows()).toEqual([
      expect.objectContaining({ visitor_id: null, traits: null, device: 'iPhone', action: 'visit' }),
    ])
  })

  it('keeps a row until just before a month has passed', () => {
    log.record(visitor, IPHONE, { action: 'visit', taskId: null, message: null })

    time = START + DEMO_VISITOR_LOG_RETENTION_MS - 1
    log.deleteOld()

    expect(rows()).toHaveLength(1)
  })

  it('deletes rows once a month has passed', () => {
    log.record(visitor, IPHONE, { action: 'visit', taskId: null, message: null })

    time = START + DEMO_VISITOR_LOG_RETENTION_MS
    log.deleteOld()

    expect(rows()).toHaveLength(0)
  })

  it('clears out old rows whenever it writes a new one', () => {
    log.record(visitor, IPHONE, { action: 'visit', taskId: null, message: null })

    time = START + DEMO_VISITOR_LOG_RETENTION_MS
    log.record(visitor, IPHONE, { action: 'visit', taskId: null, message: null })

    expect(rows().map(({ at }) => at)).toEqual([time])
  })

  it('says when the oldest row is due to go', () => {
    expect(log.nextExpiry()).toBeNull()

    log.record(visitor, IPHONE, { action: 'visit', taskId: null, message: null })

    expect(log.nextExpiry()).toBe(START + DEMO_VISITOR_LOG_RETENTION_MS)
  })

  it('stops writing once the day’s row cap is reached, and starts again the next day', () => {
    const visit = { action: 'visit', taskId: null, message: null } as const
    for (let row = 0; row < DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY; row += 1) {
      log.record(visitor, IPHONE, visit)
    }

    expect(log.record(visitor, IPHONE, visit)).toBe(false)
    expect(rows()).toHaveLength(DEMO_VISITOR_LOG_MAX_ROWS_PER_DAY)

    time = START + 24 * 60 * 60 * 1000
    expect(log.record(visitor, IPHONE, visit)).toBe(true)
  })

  it('replaces line breaks and other control characters in the user agent', () => {
    expect(cleanUserAgent('Agent\r\nInjected: yes\u0000')).toBe('Agent  Injected: yes ')
  })

  it('caps a very long user agent', () => {
    log.record(visitor, 'x'.repeat(2000), { action: 'visit', taskId: null, message: null })

    expect(String(rows()[0].user_agent)).toHaveLength(512)
  })
})

describe('activityForCommand', () => {
  it('records what was written', () => {
    expect(
      activityForCommand({ type: 'create', taskId: 't1', columnId: 'backlog', title: 'Hi', notes: 'More', at: 1 }),
    ).toEqual({ action: 'create', taskId: 't1', message: 'Hi\n\nMore' })
    expect(activityForCommand({ type: 'set-title', taskId: 't1', title: 'New' }).message).toBe('New')
    expect(activityForCommand({ type: 'set-notes', taskId: 't1', notes: 'Notes' }).message).toBe('Notes')
  })

  it('records where a card was moved', () => {
    expect(
      activityForCommand({ type: 'move', taskId: 't1', toColumnId: 'done', toIndex: 0, at: 1 }).message,
    ).toBe('to done')
  })

  it('records no message for a delete', () => {
    expect(activityForCommand({ type: 'delete', taskId: 't1' })).toEqual({
      action: 'delete',
      taskId: 't1',
      message: null,
    })
  })
})

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { MAX_REQUEST_BODY_BYTES } from '../auth/request-limits'
import type { Task } from '../board/board-model'
import {
  handleTaskApi,
  isTaskApiRequest,
  parseApiKey,
  type TaskApiOptions,
} from './task-api.server'

const URL_ = 'https://board.test/api/tasks'
const API_KEY = 'test-only-api-key-0123456789abcdefghij'
const CREATED_AT = Date.UTC(2026, 10, 9, 12, 0, 0)

function createdTask(input: { title: string; notes: string }): Task {
  return {
    id: 'abc123',
    title: input.title,
    notes: input.notes,
    createdAt: CREATED_AT,
    movedAt: CREATED_AT,
    doneAt: null,
  }
}

function options(overrides: Partial<TaskApiOptions> = {}): TaskApiOptions {
  return {
    apiKey: API_KEY,
    isWithinRateLimit: vi.fn().mockResolvedValue(true),
    createTask: vi.fn(async (input) => createdTask(input)),
    ...overrides,
  }
}

interface ApiBody {
  readonly success: boolean
  readonly data: Record<string, unknown> | null
  readonly error: string
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_KEY}`,
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.1',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function send(request: Request, api = options()) {
  const response = await handleTaskApi(request, api)
  return { response, body: (await response.json()) as ApiBody }
}

describe('isTaskApiRequest', () => {
  it('matches only the tasks endpoint', () => {
    expect(isTaskApiRequest(new Request(URL_))).toBe(true)
    expect(isTaskApiRequest(new Request('https://board.test/api/login'))).toBe(false)
    expect(isTaskApiRequest(new Request('https://board.test/'))).toBe(false)
  })
})

describe('parseApiKey', () => {
  it('returns a long enough key', () => {
    expect(parseApiKey({ API_KEY })).toBe(API_KEY)
  })

  it.each([
    ['missing', {}],
    ['too short', { API_KEY: 'short-key' }],
    ['not text', { API_KEY: 123 }],
  ])('refuses a key that is %s', (_label, env) => {
    expect(parseApiKey(env)).toBeNull()
  })
})

describe('handleTaskApi: access', () => {
  it.each([
    ['no key', {}],
    ['the wrong key', { authorization: 'Bearer not-the-right-key' }],
    ['a key that is not Bearer', { authorization: `Basic ${API_KEY}` }],
  ])('refuses %s', async (_label, headers) => {
    const api = options()
    const request = new Request(URL_, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: '{"title":"x"}',
    })

    const { response, body } = await send(request, api)

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
    expect(body).toEqual({ success: false, data: null, error: expect.any(String) })
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('refuses everyone when no key is set up', async () => {
    const api = options({ apiKey: null })

    const { response } = await send(post({ title: 'x' }), api)

    expect(response.status).toBe(503)
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('limits requests before looking at the key', async () => {
    const api = options({ isWithinRateLimit: vi.fn().mockResolvedValue(false) })

    const { response } = await send(post({ title: 'x' }), api)

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(api.isWithinRateLimit).toHaveBeenCalledWith('203.0.113.1')
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('fails safely when the limiter is down', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const api = options({ isWithinRateLimit: vi.fn().mockRejectedValue(new Error('down')) })

    const { response } = await send(post({ title: 'x' }), api)

    expect(response.status).toBe(503)
    expect(api.createTask).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('only accepts POST', async () => {
    const response = await handleTaskApi(new Request(URL_), options())

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})

describe('handleTaskApi: creating cards', () => {
  it('creates a card and returns it', async () => {
    const api = options()

    const { response, body } = await send(
      post({ title: 'Call the bank', column: 'doing', notes: 'Ask about the fee' }),
      api,
    )

    expect(response.status).toBe(201)
    expect(api.createTask).toHaveBeenCalledWith({
      title: 'Call the bank',
      columnId: 'doing',
      notes: 'Ask about the fee',
    })
    expect(body).toEqual({
      success: true,
      data: {
        id: 'abc123',
        title: 'Call the bank',
        column: 'doing',
        notes: 'Ask about the fee',
        createdAt: new Date(CREATED_AT).toISOString(),
      },
      error: null,
    })
  })

  it('puts a card in the backlog when no column is given', async () => {
    const api = options()

    await send(post({ title: 'Just a thought' }), api)

    expect(api.createTask).toHaveBeenCalledWith({
      title: 'Just a thought',
      columnId: 'backlog',
      notes: '',
    })
  })

  it.each([
    ['backlog', 'backlog'],
    ['Backlog', 'backlog'],
    ['in progress', 'doing'],
    ['In Progress', 'doing'],
    ['in-progress', 'doing'],
    ['in_progress', 'doing'],
    ['  IN   PROGRESS ', 'doing'],
    ['progress', 'doing'],
    ['doing', 'doing'],
    ['review', 'review'],
    ['In Review', 'review'],
    ['in-review', 'review'],
  ])('understands the column "%s"', async (column, columnId) => {
    const api = options()

    await send(post({ title: 'x', column }), api)

    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ columnId }))
  })

  it.each(['done', 'Done', 'nowhere', ''])('refuses the column "%s"', async (column) => {
    const api = options()

    const { response, body } = await send(post({ title: 'x', column }), api)

    expect(response.status).toBe(400)
    expect(body.error).toContain('column')
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('tidies spaces around the title and notes', async () => {
    const api = options()

    await send(post({ title: '  Spaced  ', notes: '  Note  ' }), api)

    expect(api.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Spaced', notes: 'Note' }),
    )
  })

  it.each([
    ['no title', { column: 'backlog' }],
    ['a blank title', { title: '   ' }],
    ['a title that is too long', { title: 'x'.repeat(121) }],
    ['notes that are too long', { title: 'x', notes: 'x'.repeat(5001) }],
    ['a title that is not text', { title: 5 }],
    ['a list instead of an object', ['title']],
  ])('refuses %s', async (_label, payload) => {
    const api = options()

    const { response, body } = await send(post(payload), api)

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('refuses malformed JSON', async () => {
    const { response } = await send(post('{not json'))

    expect(response.status).toBe(400)
  })

  it('refuses a body that is not JSON', async () => {
    const { response } = await send(post('title=x', { 'content-type': 'text/plain' }))

    expect(response.status).toBe(415)
  })

  it('refuses an oversized body', async () => {
    const { response } = await send(post({ title: 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1) }))

    expect(response.status).toBe(413)
  })

  it('says so when the board is full', async () => {
    const { response, body } = await send(
      post({ title: 'x' }),
      options({ createTask: vi.fn().mockResolvedValue(null) }),
    )

    expect(response.status).toBe(409)
    expect(body.error).toContain('full')
  })

  it('hides internal details when saving fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { response, body } = await send(
      post({ title: 'x' }),
      options({ createTask: vi.fn().mockRejectedValue(new Error('secret SQL detail')) }),
    )

    expect(response.status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('secret SQL detail')
    consoleError.mockRestore()
  })

  it('is never cached', async () => {
    const { response } = await send(post({ title: 'x' }))

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

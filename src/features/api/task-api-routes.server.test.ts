// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { StoredTaskDetail, TaskChange } from '../board/board-task-queries.server'
import { handleTaskApi, isTaskApiRequest, type TaskApiOptions } from './task-api.server'

const BASE = 'https://board.test'
const API_KEY = 'test-only-api-key-0123456789abcdefghij'
const AT = Date.UTC(2026, 10, 9, 12, 0, 0)
const ISO = new Date(AT).toISOString()

const stored: StoredTaskDetail = {
  id: 'abc123',
  title: 'Call the bank',
  notes: 'Ask about the fee',
  columnId: 'doing',
  createdAt: AT,
  movedAt: AT,
  doneAt: null,
  archivedAt: null,
  archiveReason: null,
  moves: [{ columnId: 'doing', at: AT }],
}

const apiTask = {
  id: 'abc123',
  title: 'Call the bank',
  notes: 'Ask about the fee',
  column: 'doing',
  status: 'ongoing',
  archived: false,
  archiveReason: null,
  createdAt: ISO,
  movedAt: ISO,
  doneAt: null,
  archivedAt: null,
}

const changed: TaskChange = { outcome: 'changed', task: stored }

function options(overrides: Partial<TaskApiOptions> = {}): TaskApiOptions {
  return {
    apiKey: API_KEY,
    isWithinRateLimit: vi.fn().mockResolvedValue(true),
    createTask: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue({ tasks: [stored], total: 1, page: 1, limit: 50, pageCount: 1 }),
    findTask: vi.fn().mockResolvedValue(stored),
    summarizeTasks: vi.fn().mockResolvedValue({ columns: [], ongoing: 0, completed: 0, archived: 0, total: 0 }),
    updateTask: vi.fn().mockResolvedValue(changed),
    removeTask: vi.fn().mockResolvedValue(true),
    archiveTask: vi.fn().mockResolvedValue(changed),
    ...overrides,
  }
}

function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${API_KEY}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function send(request: Request, api = options()) {
  const response = await handleTaskApi(request, api)
  return { response, body: (await response.json()) as Record<string, unknown> }
}

const defaults = {
  status: 'all',
  columns: [],
  archived: null,
  search: null,
  createdAfter: null,
  createdBefore: null,
  doneAfter: null,
  doneBefore: null,
  sort: 'createdAt',
  order: 'desc',
  page: 1,
  limit: 50,
}

describe('isTaskApiRequest', () => {
  it.each(['/api/tasks', '/api/tasks/abc', '/api/tasks/abc/archive', '/api/summary'])(
    'handles %s',
    (path) => {
      expect(isTaskApiRequest(new Request(`${BASE}${path}`))).toBe(true)
    },
  )

  it.each(['/api/login', '/api/logout', '/api/taskstuff', '/', '/history'])('leaves %s alone', (path) => {
    expect(isTaskApiRequest(new Request(`${BASE}${path}`))).toBe(false)
  })
})

describe('every route needs the key', () => {
  it.each([
    ['GET', '/api/tasks'],
    ['GET', '/api/tasks/abc'],
    ['PATCH', '/api/tasks/abc'],
    ['DELETE', '/api/tasks/abc'],
    ['POST', '/api/tasks/abc/archive'],
    ['GET', '/api/summary'],
    ['GET', '/api/tasks/abc/nothing'],
  ])('%s %s', async (method, path) => {
    const api = options()

    const { response } = await send(call(method, path, undefined, { authorization: 'Bearer wrong' }), api)

    expect(response.status).toBe(401)
    expect(api.listTasks).not.toHaveBeenCalled()
    expect(api.findTask).not.toHaveBeenCalled()
    expect(api.removeTask).not.toHaveBeenCalled()
    expect(api.summarizeTasks).not.toHaveBeenCalled()
  })
})

describe('routing', () => {
  it.each(['/api/tasks/abc/nothing', '/api/tasks/', '/api/tasks/bad%20id', '/api/tasks/done'])(
    'answers 404 for %s',
    async (path) => {
      const { response, body } = await send(call('GET', path))

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
    },
  )

  it.each([
    ['PUT', '/api/tasks', 'GET, POST'],
    ['POST', '/api/tasks/abc', 'GET, PATCH, DELETE'],
    ['GET', '/api/tasks/abc/archive', 'POST'],
    ['DELETE', '/api/summary', 'GET'],
  ])('refuses %s %s and says what is allowed', async (method, path, allow) => {
    const { response } = await send(call(method, path))

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe(allow)
  })
})

describe('GET /api/tasks', () => {
  it('lists cards with paging details', async () => {
    const { response, body } = await send(call('GET', '/api/tasks'))

    expect(response.status).toBe(200)
    expect(body).toEqual({
      success: true,
      data: [apiTask],
      error: null,
      meta: { total: 1, page: 1, limit: 50, pageCount: 1 },
    })
  })

  it('uses sensible defaults', async () => {
    const api = options()

    await send(call('GET', '/api/tasks'), api)

    expect(api.listTasks).toHaveBeenCalledWith(defaults)
  })

  it('passes every filter through', async () => {
    const api = options()
    const query = new URLSearchParams({
      status: 'completed',
      column: 'In Progress,review',
      archived: 'false',
      search: '  bank  ',
      createdAfter: '2026-11-01',
      createdBefore: '2026-11-02T10:00:00Z',
      doneAfter: '2026-11-03',
      doneBefore: '2026-11-04',
      sort: 'title',
      order: 'asc',
      page: '2',
      limit: '10',
    })

    await send(call('GET', `/api/tasks?${query}`), api)

    expect(api.listTasks).toHaveBeenCalledWith({
      status: 'completed',
      columns: ['doing', 'review'],
      archived: false,
      search: 'bank',
      createdAfter: Date.UTC(2026, 10, 1),
      createdBefore: Date.UTC(2026, 10, 2, 10),
      doneAfter: Date.UTC(2026, 10, 3),
      doneBefore: Date.UTC(2026, 10, 4),
      sort: 'title',
      order: 'asc',
      page: 2,
      limit: 10,
    })
  })

  it('accepts Done as a column and ignores repeats', async () => {
    const api = options()

    await send(call('GET', '/api/tasks?column=done,Done'), api)

    expect(api.listTasks).toHaveBeenCalledWith({ ...defaults, columns: ['done'] })
  })

  it.each([
    'status=maybe',
    'column=nowhere',
    'column=',
    'archived=perhaps',
    'search=',
    `search=${'x'.repeat(201)}`,
    'createdAfter=yesterday',
    'doneBefore=2026-13-45',
    'sort=password',
    'order=sideways',
    'page=0',
    'page=abc',
    'limit=0',
    'limit=201',
    'unknown=1',
  ])('refuses ?%s', async (query) => {
    const api = options()

    const { response, body } = await send(call('GET', `/api/tasks?${query}`), api)

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(api.listTasks).not.toHaveBeenCalled()
  })

  it('shows a completed card from the history', async () => {
    const filed = { ...stored, columnId: 'done', doneAt: AT, archivedAt: AT, archiveReason: 'expired' }

    const { body } = await send(
      call('GET', '/api/tasks'),
      options({ listTasks: vi.fn().mockResolvedValue({ tasks: [filed], total: 1, page: 1, limit: 50, pageCount: 1 }) }),
    )

    expect((body.data as unknown[])[0]).toMatchObject({
      column: 'done',
      status: 'completed',
      archived: true,
      archiveReason: 'expired',
      doneAt: ISO,
      archivedAt: ISO,
    })
  })
})

describe('GET /api/tasks/:id', () => {
  it('returns the card and its timeline', async () => {
    const { response, body } = await send(call('GET', '/api/tasks/abc123'))

    expect(response.status).toBe(200)
    expect(body.data).toEqual({ ...apiTask, moves: [{ column: 'doing', at: ISO }] })
  })

  it('answers 404 for an unknown card', async () => {
    const { response } = await send(
      call('GET', '/api/tasks/nope'),
      options({ findTask: vi.fn().mockResolvedValue(null) }),
    )

    expect(response.status).toBe(404)
  })
})

describe('PATCH /api/tasks/:id', () => {
  it('updates a card and returns it', async () => {
    const api = options()

    const { response, body } = await send(
      call('PATCH', '/api/tasks/abc123', {
        title: ' New ',
        notes: ' More ',
        column: 'Done',
        position: 0,
      }),
      api,
    )

    expect(response.status).toBe(200)
    expect(api.updateTask).toHaveBeenCalledWith('abc123', {
      title: 'New',
      notes: 'More',
      columnId: 'done',
      position: 0,
    })
    expect(body.data).toEqual({ ...apiTask, moves: [{ column: 'doing', at: ISO }] })
  })

  it('sends only the fields that were given', async () => {
    const api = options()

    await send(call('PATCH', '/api/tasks/abc123', { notes: '' }), api)

    expect(api.updateTask).toHaveBeenCalledWith('abc123', { notes: '' })
  })

  it.each([
    ['nothing', {}],
    ['a blank title', { title: '  ' }],
    ['a long title', { title: 'x'.repeat(121) }],
    ['long notes', { notes: 'x'.repeat(5001) }],
    ['a bad column', { column: 'nowhere' }],
    ['a negative position', { position: -1 }],
    ['a fractional position', { position: 1.5 }],
    ['an unknown field', { title: 'x', archivedAt: 1 }],
  ])('refuses %s', async (_label, payload) => {
    const api = options()

    const { response } = await send(call('PATCH', '/api/tasks/abc123', payload), api)

    expect(response.status).toBe(400)
    expect(api.updateTask).not.toHaveBeenCalled()
  })

  it('needs a JSON body', async () => {
    const request = call('PATCH', '/api/tasks/abc123', { title: 'x' }, { 'content-type': 'text/plain' })

    expect((await send(request)).response.status).toBe(415)
  })

  it.each([
    ['missing', 404],
    ['history', 409],
  ] as const)('maps %s to %i', async (outcome, status) => {
    const { response } = await send(
      call('PATCH', '/api/tasks/abc123', { title: 'x' }),
      options({ updateTask: vi.fn().mockResolvedValue({ outcome }) }),
    )

    expect(response.status).toBe(status)
  })
})

describe('DELETE /api/tasks/:id', () => {
  it('deletes the card', async () => {
    const api = options()

    const { response, body } = await send(call('DELETE', '/api/tasks/abc123'), api)

    expect(response.status).toBe(200)
    expect(api.removeTask).toHaveBeenCalledWith('abc123')
    expect(body.data).toEqual({ id: 'abc123', deleted: true })
  })

  it('answers 404 for an unknown card', async () => {
    const { response } = await send(
      call('DELETE', '/api/tasks/nope'),
      options({ removeTask: vi.fn().mockResolvedValue(false) }),
    )

    expect(response.status).toBe(404)
  })
})

describe('POST /api/tasks/:id/archive', () => {
  it('moves a done card to the history', async () => {
    const api = options()

    const { response } = await send(call('POST', '/api/tasks/abc123/archive'), api)

    expect(response.status).toBe(200)
    expect(api.archiveTask).toHaveBeenCalledWith('abc123')
  })

  it.each([
    ['missing', 404],
    ['history', 409],
    ['not-done', 409],
  ] as const)('maps %s to %i', async (outcome, status) => {
    const { response } = await send(
      call('POST', '/api/tasks/abc123/archive'),
      options({ archiveTask: vi.fn().mockResolvedValue({ outcome }) }),
    )

    expect(response.status).toBe(status)
  })
})

describe('GET /api/summary', () => {
  it('returns the counts', async () => {
    const summary = {
      columns: [{ id: 'backlog', title: 'Backlog', count: 2 }],
      ongoing: 2,
      completed: 0,
      archived: 0,
      total: 2,
    }

    const { response, body } = await send(
      call('GET', '/api/summary'),
      options({ summarizeTasks: vi.fn().mockResolvedValue(summary) }),
    )

    expect(response.status).toBe(200)
    expect(body.data).toEqual(summary)
  })
})

describe('failures', () => {
  it('hides internal details on any route', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { response, body } = await send(
      call('GET', '/api/tasks'),
      options({ listTasks: vi.fn().mockRejectedValue(new Error('secret SQL detail')) }),
    )

    expect(response.status).toBe(500)
    expect(JSON.stringify(body)).not.toContain('secret SQL detail')
    consoleError.mockRestore()
  })

  it('is never cached on any route', async () => {
    const { response } = await send(call('GET', '/api/tasks'))

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

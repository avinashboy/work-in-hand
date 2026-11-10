// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  MOCK_HISTORY_HEADER,
  MOCK_HISTORY_PATH,
  handleMockHistoryRequest,
  isMockHistoryRequest,
} from './dev-routes.server'

const LOCAL = `http://localhost:3000${MOCK_HISTORY_PATH}`
const FROM_SCRIPT = { [MOCK_HISTORY_HEADER]: '1' }

function call(method: string, url = LOCAL, headers: Record<string, string> = FROM_SCRIPT): Request {
  return new Request(url, { method, headers })
}

function seeder() {
  return { add: vi.fn(async () => 20), remove: vi.fn(async () => 20) }
}

describe('mock History route (local dev only)', () => {
  it('answers only at its own path', () => {
    expect(isMockHistoryRequest(new Request(LOCAL, { method: 'POST' }))).toBe(true)
    expect(isMockHistoryRequest(new Request('http://localhost:3000/history'))).toBe(false)
  })

  it('adds the mock cards on POST', async () => {
    const mock = seeder()
    const response = await handleMockHistoryRequest(call('POST'), mock)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ added: 20 })
    expect(mock.add).toHaveBeenCalledOnce()
  })

  it('removes the mock cards on DELETE', async () => {
    const mock = seeder()
    const response = await handleMockHistoryRequest(call('DELETE'), mock)

    expect(await response.json()).toEqual({ removed: 20 })
    expect(mock.remove).toHaveBeenCalledOnce()
  })

  it('refuses other methods', async () => {
    const mock = seeder()
    const response = await handleMockHistoryRequest(call('GET'), mock)

    expect(response.status).toBe(405)
    expect(mock.add).not.toHaveBeenCalled()
  })

  it('refuses anything not addressed to this computer', async () => {
    const mock = seeder()
    const response = await handleMockHistoryRequest(
      call('POST', `https://example.workers.dev${MOCK_HISTORY_PATH}`),
      mock,
    )

    expect(response.status).toBe(403)
    expect(mock.add).not.toHaveBeenCalled()
  })

  it('refuses a call without the script header, so a web page cannot trigger it', async () => {
    const mock = seeder()
    const response = await handleMockHistoryRequest(call('POST', LOCAL, {}), mock)

    expect(response.status).toBe(403)
    expect(mock.add).not.toHaveBeenCalled()
  })
})

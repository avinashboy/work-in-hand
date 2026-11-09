import { describe, expect, it, vi } from 'vitest'
import { checkDemoRequest, type DemoGateOptions } from './demo-gate.server'

const SITE = 'https://demo.example.com'

function request(path: string): Request {
  return new Request(`${SITE}${path}`, { headers: { 'cf-connecting-ip': '203.0.113.9' } })
}

function options(overrides: Partial<DemoGateOptions> = {}): DemoGateOptions {
  return {
    isClientWithinLimit: vi.fn().mockResolvedValue(true),
    isSiteWithinLimit: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('checkDemoRequest', () => {
  it('lets a normal request through', async () => {
    expect(await checkDemoRequest(request('/'), options())).toBeNull()
  })

  it('counts each visitor by their connection', async () => {
    const gate = options()

    await checkDemoRequest(request('/'), gate)

    expect(gate.isClientWithinLimit).toHaveBeenCalledWith('203.0.113.9')
  })

  it.each(['/api/tasks', '/api/tasks/abc', '/api/summary', '/api/login', '/api/logout'])(
    'has no %s endpoint',
    async (path) => {
      const response = await checkDemoRequest(request(path), options())

      expect(response?.status).toBe(404)
    },
  )

  it('sends the login page back to the board', async () => {
    const response = await checkDemoRequest(request('/login'), options())

    expect(response?.status).toBe(303)
    expect(response?.headers.get('location')).toBe('/')
  })

  it('asks search engines to stay away', async () => {
    const response = await checkDemoRequest(request('/robots.txt'), options())

    expect(response?.status).toBe(200)
    expect(await response?.text()).toContain('Disallow: /')
  })

  it('refuses a visitor who is over their limit', async () => {
    const response = await checkDemoRequest(
      request('/'),
      options({ isClientWithinLimit: vi.fn().mockResolvedValue(false) }),
    )

    expect(response?.status).toBe(429)
    expect(response?.headers.get('retry-after')).toBe('60')
  })

  it('does not spend the site budget on a visitor who is over their limit', async () => {
    const gate = options({ isClientWithinLimit: vi.fn().mockResolvedValue(false) })

    await checkDemoRequest(request('/'), gate)

    expect(gate.isSiteWithinLimit).not.toHaveBeenCalled()
  })

  it('refuses everyone when the whole site is over its limit', async () => {
    const response = await checkDemoRequest(
      request('/'),
      options({ isSiteWithinLimit: vi.fn().mockResolvedValue(false) }),
    )

    expect(response?.status).toBe(429)
  })

  it('stays closed if the limiter breaks, to protect the free quota', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await checkDemoRequest(
      request('/'),
      options({ isClientWithinLimit: vi.fn().mockRejectedValue(new Error('down')) }),
    )

    expect(response?.status).toBe(503)
    errorLog.mockRestore()
  })
})

import { describe, expect, it } from 'vitest'
import { clientNameFromUrl, resolveAgentName } from './mcp-client-name'

describe('resolveAgentName', () => {
  it('turns well-known client names into friendly ones', () => {
    expect(resolveAgentName({ requested: 'claude-desktop' })).toBe('Claude Desktop')
    expect(resolveAgentName({ requested: 'claude-code' })).toBe('Claude Code')
    expect(resolveAgentName({ requested: 'cursor' })).toBe('Cursor')
    expect(resolveAgentName({ requested: 'vscode' })).toBe('VS Code')
    expect(resolveAgentName({ requested: 'chatgpt' })).toBe('ChatGPT')
  })

  it('prefers the name in the address over what the client says about itself', () => {
    expect(resolveAgentName({ requested: 'claude-desktop', clientInfo: { name: 'mcp-remote' } })).toBe(
      'Claude Desktop',
    )
  })

  it('uses the name a client sends with the request when the address names none', () => {
    expect(resolveAgentName({ clientInfo: { name: 'cursor-vscode', title: 'Cursor' } })).toBe('Cursor')
    expect(resolveAgentName({ clientInfo: { name: 'claude-ai' } })).toBe('Claude')
  })

  it('recognises well-known user agents, and ignores generic ones', () => {
    expect(resolveAgentName({ userAgent: 'claude-code/2.1.0 (cli)' })).toBe('Claude Code')
    expect(resolveAgentName({ userAgent: 'undici' })).toBeNull()
    expect(resolveAgentName({ userAgent: 'node' })).toBeNull()
    expect(resolveAgentName({ userAgent: 'python-httpx/0.27' })).toBeNull()
  })

  it('keeps an unknown name, cleaned and shortened', () => {
    expect(resolveAgentName({ requested: 'my-home-bot' })).toBe('my home bot')
    expect(resolveAgentName({ requested: 'x'.repeat(100) })).toHaveLength(40)
  })

  it('drops anything that is not plain text', () => {
    expect(resolveAgentName({ requested: '<img src=x onerror=alert(1)>' })).toBe('img srcx onerroralert(1)')
    expect(resolveAgentName({ requested: '\u0000‮' })).toBeNull()
    expect(resolveAgentName({ requested: '   ' })).toBeNull()
  })

  it('returns null when nothing names the agent', () => {
    expect(resolveAgentName({})).toBeNull()
  })
})

describe('clientNameFromUrl', () => {
  it('reads the client parameter from the address', () => {
    expect(clientNameFromUrl('https://board.test/mcp?client=claude-desktop')).toBe('claude-desktop')
    expect(clientNameFromUrl('https://board.test/mcp')).toBeNull()
  })
})

/**
 * Works out which AI app is calling, so History can say "AI agent:
 * Claude Desktop". Older MCP clients only name themselves in the first
 * handshake, which this stateless server never links to later calls, so a
 * client can also name itself in the address: /mcp?client=claude-desktop.
 */

const MAX_NAME_LENGTH = 40
const CLIENT_PARAM = 'client'

/** Checked in order, so the more specific Claude names come first. */
const KNOWN_CLIENTS: readonly (readonly [RegExp, string])[] = [
  [/claude[\s_-]*desktop/i, 'Claude Desktop'],
  [/claude[\s_-]*code/i, 'Claude Code'],
  [/claude/i, 'Claude'],
  [/chat[\s_-]*gpt|openai/i, 'ChatGPT'],
  [/cursor/i, 'Cursor'],
  [/windsurf/i, 'Windsurf'],
  [/visual[\s_-]*studio[\s_-]*code|vs[\s_-]*code|copilot/i, 'VS Code'],
  [/zed/i, 'Zed'],
  [/inspector/i, 'MCP Inspector'],
]

// Only these characters survive; anything else is dropped, so a name is always plain text.
const DISALLOWED = /[^\p{L}\p{N} ._()-]/gu

export interface AgentNameHints {
  /** From ?client= in the address the client was set up with. */
  readonly requested?: string | null
  /** What a newer client sends about itself with every request. */
  readonly clientInfo?: { readonly name?: string; readonly title?: string } | null
  readonly userAgent?: string | null
}

function knownName(value: string): string | null {
  return KNOWN_CLIENTS.find(([pattern]) => pattern.test(value))?.[1] ?? null
}

function cleaned(value: string): string | null {
  const text = value
    .replace(/[-_]+/g, ' ')
    .replace(DISALLOWED, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim()
  return text === '' ? null : text
}

/** A known name, or the value itself, cleaned. */
function nameFrom(value: string | null | undefined): string | null {
  if (!value) return null
  return knownName(value) ?? cleaned(value)
}

/**
 * The best name for the calling agent, or null when nothing names it. A user
 * agent only counts when it is a known app: generic ones like "undici" or
 * "node" say nothing about which agent sent the call.
 */
export function resolveAgentName({ requested, clientInfo, userAgent }: AgentNameHints): string | null {
  return (
    nameFrom(requested) ??
    nameFrom(clientInfo?.title) ??
    nameFrom(clientInfo?.name) ??
    (userAgent ? knownName(userAgent) : null)
  )
}

export function clientNameFromUrl(url: string): string | null {
  return new URL(url).searchParams.get(CLIENT_PARAM)
}

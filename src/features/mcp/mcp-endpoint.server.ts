import { createMcpHandler } from 'agents/mcp/server'
import { isBodyWithinLimit } from '../auth/request-limits'
import { fail } from '../api/task-api-response'
import type { TaskApiStore } from '../api/task-api-routes.server'
import { checkApiAccess, refuseIfOverLimit, type ApiAccessOptions } from '../api/task-api.server'
import { clientNameFromUrl } from './mcp-client-name'
import { MCP_PATH } from './mcp-path'
import { createBoardMcpServer } from './mcp-server'

export interface McpEndpointOptions extends ApiAccessOptions {
  readonly store: TaskApiStore
}

/**
 * Entry point for MCP clients such as Claude, ChatGPT, Cursor and VS Code.
 * It uses the same API key and rate limit as the REST API. CORS preflights
 * skip only the key, since browsers send them without one; they still count
 * toward the rate limit.
 */
export async function handleMcpRequest(
  request: Request,
  options: McpEndpointOptions,
  context: ExecutionContext,
): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') {
      const refusal = await refuseIfOverLimit(request, options)
      if (refusal) return refusal
    } else {
      const refusal = await checkApiAccess(request, options)
      if (refusal) return refusal
      if (!(await isBodyWithinLimit(request))) return fail(413, 'Request too large')
    }

    const hints = {
      requested: clientNameFromUrl(request.url),
      userAgent: request.headers.get('user-agent'),
    }
    const handler = createMcpHandler(() => createBoardMcpServer(options.store, hints), { route: MCP_PATH })
    return await handler(request, undefined, context)
  } catch (error) {
    console.error('Could not process the MCP request:', error)
    return fail(500, 'Something went wrong')
  }
}

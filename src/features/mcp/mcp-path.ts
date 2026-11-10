/**
 * The one address every MCP client connects to, over Streamable HTTP. Kept
 * apart from the endpoint so checking a path doesn't load the MCP libraries.
 */
export const MCP_PATH = '/mcp'

export function isMcpRequest(request: Request): boolean {
  return new URL(request.url).pathname === MCP_PATH
}

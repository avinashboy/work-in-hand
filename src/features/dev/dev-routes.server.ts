/**
 * Local development only. src/server.ts reaches this behind
 * `import.meta.env.DEV`, which is false in every build, so it never ships.
 *
 *   npm run mock:history          adds 20 finished cards to History
 *   npm run mock:history:remove   takes them out again
 */

export const MOCK_HISTORY_PATH = '/__dev/mock-history'
/**
 * Sent by the npm scripts. A web page can't add a custom header to a
 * cross-site request without the dev server agreeing first, so a page open
 * in your browser can't trigger this route.
 */
export const MOCK_HISTORY_HEADER = 'x-mock-history'

export interface MockHistorySeeder {
  readonly add: () => Promise<number>
  readonly remove: () => Promise<number>
}

export function isMockHistoryRequest(request: Request): boolean {
  return new URL(request.url).pathname === MOCK_HISTORY_PATH
}

export async function handleMockHistoryRequest(
  request: Request,
  seeder: MockHistorySeeder,
): Promise<Response> {
  const isLocal = new URL(request.url).hostname === 'localhost'
  if (!isLocal || request.headers.get(MOCK_HISTORY_HEADER) !== '1') {
    return Response.json({ error: 'Local development only' }, { status: 403 })
  }
  if (request.method === 'POST') return Response.json({ added: await seeder.add() })
  if (request.method === 'DELETE') return Response.json({ removed: await seeder.remove() })
  return Response.json({ error: 'Use POST to add or DELETE to remove' }, { status: 405 })
}

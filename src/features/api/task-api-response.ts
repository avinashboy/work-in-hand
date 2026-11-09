type Headers = Readonly<Record<string, string>>

export interface PageMeta {
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly pageCount: number
}

function respond(
  status: number,
  body: { readonly data: unknown; readonly error: string | null; readonly meta?: PageMeta },
  headers: Headers = {},
): Response {
  const { data, error, meta } = body
  return Response.json(
    { success: error === null, data, error, ...(meta ? { meta } : {}) },
    {
      status,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        ...headers,
      },
    },
  )
}

export function succeed(data: unknown, status = 200, meta?: PageMeta): Response {
  return respond(status, { data, error: null, meta })
}

export function fail(status: number, error: string, headers?: Headers): Response {
  return respond(status, { data: null, error }, headers)
}

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_REQUEST_BODY_BYTES, isBodyWithinLimit } from './request-limits'

const URL = 'http://localhost/_serverFn/x'

function streamOf(chunks: readonly number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((size) => controller.enqueue(new Uint8Array(size)))
      controller.close()
    },
  })
}

function streamed(chunks: readonly number[], headers: HeadersInit = {}) {
  return new Request(URL, {
    method: 'POST',
    body: streamOf(chunks),
    headers,
    duplex: 'half',
  } as RequestInit)
}

describe('isBodyWithinLimit', () => {
  it('allows a request with no body', async () => {
    expect(await isBodyWithinLimit(new Request(URL, { method: 'POST' }))).toBe(true)
  })

  it('allows a body exactly at the limit', async () => {
    expect(await isBodyWithinLimit(streamed([MAX_REQUEST_BODY_BYTES]))).toBe(true)
  })

  it('refuses a declared length over the limit without reading it', async () => {
    const neverEnds = new ReadableStream<Uint8Array>({ start() {} })
    const request = new Request(URL, {
      method: 'POST',
      body: neverEnds,
      headers: { 'content-length': String(MAX_REQUEST_BODY_BYTES + 1) },
      duplex: 'half',
    } as RequestInit)

    expect(await isBodyWithinLimit(request)).toBe(false)
  })

  it('refuses a stream that goes over with no declared length', async () => {
    expect(
      await isBodyWithinLimit(streamed([MAX_REQUEST_BODY_BYTES, 1])),
    ).toBe(false)
  })

  it('refuses a stream that lies about its length', async () => {
    const request = streamed([MAX_REQUEST_BODY_BYTES + 1], { 'content-length': '10' })

    expect(await isBodyWithinLimit(request)).toBe(false)
  })

  it('gives up at once on a stream that goes over and never finishes', async () => {
    const neverFinishes = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(MAX_REQUEST_BODY_BYTES + 1))
      },
    })
    const request = new Request(URL, {
      method: 'POST',
      body: neverFinishes,
      duplex: 'half',
    } as RequestInit)

    expect(await isBodyWithinLimit(request)).toBe(false)
  })

  it('leaves the body readable for the real handler', async () => {
    const request = new Request(URL, { method: 'POST', body: 'hello' })

    await isBodyWithinLimit(request)

    expect(await request.text()).toBe('hello')
  })
})

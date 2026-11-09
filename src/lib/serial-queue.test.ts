import { describe, expect, it } from 'vitest'
import { createSerialQueue } from './serial-queue'

function deferred() {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise((done) => setTimeout(done, 0))

describe('createSerialQueue', () => {
  it('runs one task at a time, in order', async () => {
    const run = createSerialQueue()
    const started: string[] = []
    const first = deferred()

    const a = run(async () => {
      started.push('a')
      await first.promise
    })
    const b = run(async () => {
      started.push('b')
    })
    await flush()

    expect(started).toEqual(['a'])

    first.resolve()
    await Promise.all([a, b])

    expect(started).toEqual(['a', 'b'])
  })

  it('returns each task its own result', async () => {
    const run = createSerialQueue()

    expect(await Promise.all([run(async () => 1), run(async () => 2)])).toEqual([1, 2])
  })

  it('keeps going after a task fails', async () => {
    const run = createSerialQueue()

    const failed = run(async () => {
      throw new Error('boom')
    })
    const next = run(async () => 'still works')

    await expect(failed).rejects.toThrow('boom')
    expect(await next).toBe('still works')
  })
})

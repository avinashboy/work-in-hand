/** Runs async tasks one at a time, in the order they were added. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()

  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task)
    tail = result.catch(() => undefined) // One failure mustn't stop the rest.
    return result
  }
}

// Far above any real request: a card title is 120 characters at most.
export const MAX_REQUEST_BODY_BYTES = 16 * 1024

/** Reads a copy of the body, stopping as soon as it goes over the limit. */
export async function isBodyWithinLimit(request: Request): Promise<boolean> {
  const declaredBytes = Number(request.headers.get('content-length') ?? 0)
  if (declaredBytes > MAX_REQUEST_BODY_BYTES) return false

  const reader = request.clone().body?.getReader()
  if (!reader) return true

  let totalBytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return true

    totalBytes += value.byteLength
    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      // Not awaited: cancelling a clone only settles once the original ends too.
      reader.cancel().catch(() => undefined)
      return false
    }
  }
}

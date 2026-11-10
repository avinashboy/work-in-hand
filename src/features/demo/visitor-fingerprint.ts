import type { UnknownComponents } from '@fingerprintjs/fingerprintjs'
import { parseVisitorFingerprint, type VisitorFingerprint, type VisitorTraits } from './visitor-model'

/** A save never waits longer than this for the fingerprint. */
const FINGERPRINT_TIMEOUT_MS = 2000
const MAX_TRAIT_LENGTH = 100

let fingerprint: Promise<VisitorFingerprint | null> | null = null

/** A component's value, or undefined when the browser couldn't provide it. */
function valueOf(components: UnknownComponents, name: string): unknown {
  const component = components[name]
  return component && 'value' in component ? component.value : undefined
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value.slice(0, MAX_TRAIT_LENGTH) : null
}

function wholeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function screenSize(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [width, height] = value
  return typeof width === 'number' && typeof height === 'number' ? `${width}x${height}` : null
}

function languages(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.flat().filter((item): item is string => typeof item === 'string').slice(0, 10)
}

function touchPoints(value: unknown): number | null {
  if (typeof value !== 'object' || value === null || !('maxTouchPoints' in value)) return null
  return wholeNumber(value.maxTouchPoints)
}

/** Read defensively: component shapes may change between minor versions. */
export function pickTraits(components: UnknownComponents): VisitorTraits {
  const memory = valueOf(components, 'deviceMemory')
  return {
    platform: text(valueOf(components, 'platform')),
    timezone: text(valueOf(components, 'timezone')),
    languages: [...languages(valueOf(components, 'languages'))].map((item) =>
      item.slice(0, MAX_TRAIT_LENGTH),
    ),
    screen: screenSize(valueOf(components, 'screenResolution')),
    touchPoints: touchPoints(valueOf(components, 'touchSupport')),
    cpuCores: wholeNumber(valueOf(components, 'hardwareConcurrency')),
    memoryGb: typeof memory === 'number' && memory >= 0 ? memory : null,
    vendor: text(valueOf(components, 'vendor')),
  }
}

async function computeFingerprint(): Promise<VisitorFingerprint | null> {
  // Loaded only when needed, so the private site never downloads it.
  const { load } = await import('@fingerprintjs/fingerprintjs')
  // monitoring: false stops the library calling FingerprintJS's servers.
  const agent = await load({ monitoring: false })
  const result = await agent.get()
  return parseVisitorFingerprint({
    visitorId: result.visitorId,
    confidence: result.confidence.score,
    traits: pickTraits(result.components as UnknownComponents),
  })
}

function withTimeout<T>(work: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), FINGERPRINT_TIMEOUT_MS)),
  ])
}

/**
 * The browser's fingerprint, worked out once per page and then reused.
 * Null on the server, or when the browser blocks it: saving still works.
 */
export function getVisitorFingerprint(): Promise<VisitorFingerprint | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  fingerprint ??= computeFingerprint().catch(() => null)
  return withTimeout(fingerprint, null)
}

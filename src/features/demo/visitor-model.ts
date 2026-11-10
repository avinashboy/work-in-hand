import { z } from 'zod'

const MAX_TRAIT_LENGTH = 100
const MAX_LANGUAGES = 10

const traitTextSchema = z.string().max(MAX_TRAIT_LENGTH)

/**
 * A few of the browser's fingerprint components, kept small and plain so they
 * are useful in the log without storing the whole fingerprint.
 */
export const visitorTraitsSchema = z.object({
  platform: traitTextSchema.nullable(),
  timezone: traitTextSchema.nullable(),
  languages: z.array(traitTextSchema).max(MAX_LANGUAGES),
  screen: traitTextSchema.nullable(),
  touchPoints: z.number().int().min(0).max(1000).nullable(),
  cpuCores: z.number().int().min(0).max(1024).nullable(),
  memoryGb: z.number().min(0).max(1024).nullable(),
  vendor: traitTextSchema.nullable(),
})

/**
 * What the demo page sends about its browser. It comes from the visitor, so
 * it is only a hint: anyone can change it, and the server checks its shape.
 */
export const visitorFingerprintSchema = z.object({
  // FingerprintJS visitor ids are a 128-bit hash written as 32 hex digits.
  visitorId: z.string().regex(/^[0-9a-f]{32}$/),
  confidence: z.number().min(0).max(1),
  traits: visitorTraitsSchema,
})

export type VisitorTraits = z.infer<typeof visitorTraitsSchema>
export type VisitorFingerprint = z.infer<typeof visitorFingerprintSchema>

/** The fingerprint if it is well formed, otherwise null. Never throws. */
export function parseVisitorFingerprint(value: unknown): VisitorFingerprint | null {
  const parsed = visitorFingerprintSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

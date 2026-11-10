import { describe, expect, it } from 'vitest'
import { pickTraits } from './visitor-fingerprint'
import { parseVisitorFingerprint } from './visitor-model'

const traits = {
  platform: 'MacIntel',
  timezone: 'Europe/London',
  languages: ['en-GB'],
  screen: '1512x982',
  touchPoints: 0,
  cpuCores: 8,
  memoryGb: 8,
  vendor: 'Google Inc.',
}

const valid = { visitorId: 'a'.repeat(32), confidence: 0.5, traits }

describe('parseVisitorFingerprint', () => {
  it('accepts a well-formed fingerprint', () => {
    expect(parseVisitorFingerprint(valid)).toEqual(valid)
  })

  it('refuses a visitor id that is not 32 hex digits', () => {
    expect(parseVisitorFingerprint({ ...valid, visitorId: '<script>' })).toBeNull()
    expect(parseVisitorFingerprint({ ...valid, visitorId: 'a'.repeat(33) })).toBeNull()
  })

  it('refuses a confidence outside 0 to 1', () => {
    expect(parseVisitorFingerprint({ ...valid, confidence: 2 })).toBeNull()
  })

  it('refuses oversized traits', () => {
    expect(parseVisitorFingerprint({ ...valid, traits: { ...traits, platform: 'x'.repeat(101) } })).toBeNull()
  })

  it('refuses anything that is not an object', () => {
    expect(parseVisitorFingerprint(null)).toBeNull()
    expect(parseVisitorFingerprint('fingerprint')).toBeNull()
  })
})

describe('pickTraits', () => {
  it('takes the useful components and ignores the rest', () => {
    const components = {
      platform: { value: 'iPhone', duration: 0 },
      timezone: { value: 'Asia/Kolkata', duration: 0 },
      languages: { value: [['en-IN'], ['hi']], duration: 0 },
      screenResolution: { value: [390, 844], duration: 0 },
      touchSupport: { value: { maxTouchPoints: 5, touchEvent: true, touchStart: true }, duration: 0 },
      hardwareConcurrency: { value: 6, duration: 0 },
      deviceMemory: { error: new Error('blocked'), duration: 0 },
      vendor: { value: 'Apple Computer, Inc.', duration: 0 },
      canvas: { value: { geometry: 'long-data-url' }, duration: 0 },
    }

    expect(pickTraits(components)).toEqual({
      platform: 'iPhone',
      timezone: 'Asia/Kolkata',
      languages: ['en-IN', 'hi'],
      screen: '390x844',
      touchPoints: 5,
      cpuCores: 6,
      memoryGb: null,
      vendor: 'Apple Computer, Inc.',
    })
  })

  it('copes with every component missing', () => {
    expect(pickTraits({})).toEqual({
      platform: null,
      timezone: null,
      languages: [],
      screen: null,
      touchPoints: null,
      cpuCores: null,
      memoryGb: null,
      vendor: null,
    })
  })
})

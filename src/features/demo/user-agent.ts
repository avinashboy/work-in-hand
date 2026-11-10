export type DeviceType = 'Phone' | 'Tablet' | 'Desktop' | 'Unknown'

export interface DeviceInfo {
  /** For example "iPhone", "Android phone", "Mac" or "Windows PC". */
  readonly device: string
  readonly deviceType: DeviceType
  /** For example "iOS 18.2", "Android 15" or "macOS". */
  readonly os: string
  /** For example "Chrome 142" or "Safari 18". */
  readonly browser: string
}

interface OsMatch {
  readonly os: string
  readonly device: string
  readonly deviceType: DeviceType
}

const UNKNOWN: DeviceInfo = { device: 'Unknown', deviceType: 'Unknown', os: 'Unknown', browser: 'Unknown' }

function version(userAgent: string, pattern: RegExp): string {
  const found = pattern.exec(userAgent)?.[1]
  return found ? ` ${found.replace(/_/g, '.')}` : ''
}

/** iPads ask for the desktop site, so only touch support tells one from a Mac. */
function appleOs(userAgent: string, touchPoints: number | null): OsMatch | null {
  if (/iPhone|iPod/.test(userAgent)) {
    return { os: `iOS${version(userAgent, /OS (\d+[_\d]*)/)}`, device: 'iPhone', deviceType: 'Phone' }
  }
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && (touchPoints ?? 0) > 1)) {
    return { os: `iPadOS${version(userAgent, /OS (\d+[_\d]*)/)}`, device: 'iPad', deviceType: 'Tablet' }
  }
  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return { os: 'macOS', device: 'Mac', deviceType: 'Desktop' }
  }
  return null
}

function otherOs(userAgent: string): OsMatch | null {
  if (/Android/.test(userAgent)) {
    const isPhone = /Mobile/.test(userAgent)
    return {
      os: `Android${version(userAgent, /Android (\d+(?:\.\d+)?)/)}`,
      device: isPhone ? 'Android phone' : 'Android tablet',
      deviceType: isPhone ? 'Phone' : 'Tablet',
    }
  }
  if (/Windows/.test(userAgent)) return { os: 'Windows', device: 'Windows PC', deviceType: 'Desktop' }
  if (/CrOS/.test(userAgent)) return { os: 'ChromeOS', device: 'Chromebook', deviceType: 'Desktop' }
  if (/Linux/.test(userAgent)) return { os: 'Linux', device: 'Linux PC', deviceType: 'Desktop' }
  return null
}

/** Checked in order: Edge, Opera and Samsung also say "Chrome", and Chrome also says "Safari". */
const BROWSERS: readonly (readonly [string, RegExp])[] = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /(?:OPR|Opera)\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+(?:\.\d+)?).*Safari/],
]

function browserOf(userAgent: string): string {
  for (const [name, pattern] of BROWSERS) {
    const found = pattern.exec(userAgent)?.[1]
    if (found) return `${name} ${found}`
  }
  return 'Unknown'
}

/**
 * Works out the device, system and browser from the user agent. The user
 * agent comes from the visitor, so this is a best guess, not proof.
 */
export function describeUserAgent(userAgent: string | null, touchPoints: number | null = null): DeviceInfo {
  if (!userAgent) return UNKNOWN
  const os = appleOs(userAgent, touchPoints) ?? otherOs(userAgent)
  return {
    device: os?.device ?? 'Unknown',
    deviceType: os?.deviceType ?? 'Unknown',
    os: os?.os ?? 'Unknown',
    browser: browserOf(userAgent),
  }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_VERSION } from './app-version'

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/
const HEADING_PATTERN = /^## (\d+\.\d+\.\d+)\b/gm

function versionsInRecord(): string[] {
  const record = readFileSync(join(process.cwd(), 'version.md'), 'utf8')
  return Array.from(record.matchAll(HEADING_PATTERN), (match) => match[1])
}

function compareVersions(a: string, b: string): number {
  const [left, right] = [a, b].map((value) => value.split('.').map(Number))
  const index = left.findIndex((part, position) => part !== right[position])
  return index === -1 ? 0 : left[index] - right[index]
}

describe('app version', () => {
  it('is a MAJOR.MINOR.PATCH number', () => {
    expect(APP_VERSION).toMatch(VERSION_PATTERN)
  })

  it('matches the newest entry in version.md', () => {
    expect(versionsInRecord()[0]).toBe(APP_VERSION)
  })

  it('has no version listed twice in version.md', () => {
    const versions = versionsInRecord()

    expect(new Set(versions).size).toBe(versions.length)
  })

  it('keeps version.md newest first', () => {
    const versions = versionsInRecord()
    const sorted = [...versions].sort((a, b) => compareVersions(b, a))

    expect(versions).toEqual(sorted)
  })
})

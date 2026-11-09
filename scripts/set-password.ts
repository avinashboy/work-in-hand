import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
} from '../src/features/auth/auth-password.server.ts'

const ENV_FILE = '.env'
const ENV_KEY = 'BOARD_PASSWORD_HASH'
const ENV_LINE = new RegExp(`^\\s*(export\\s+)?${ENV_KEY}\\s*=`)
const MAX_PASSWORD_LENGTH = 256
const OWNER_ONLY_FILE = 0o600

async function askHidden(question: string): Promise<string> {
  const silent = new Writable({ write: (_chunk, _encoding, done) => done() })
  const prompt = createInterface({
    input: process.stdin,
    output: silent,
    terminal: true,
  })
  process.stdout.write(question)
  const answer = await prompt.question('')
  prompt.close()
  process.stdout.write('\n')
  return answer
}

async function readPipedLine(): Promise<string> {
  const lines = createInterface({ input: process.stdin })
  // PowerShell can prepend an invisible byte-order mark to piped text.
  for await (const line of lines) return line.replace(/^﻿/, '')
  return ''
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readPipedLine()

  const first = await askHidden('New password: ')
  const second = await askHidden('Type it again: ')
  if (first !== second) throw new Error('The two passwords did not match.')
  return first
}

function writeEnvValue(value: string): void {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : ''
  const otherLines = existing
    .split(/\r?\n/)
    .filter((line) => line !== '' && !ENV_LINE.test(line))
  const content = [...otherLines, `${ENV_KEY}=${value}`, ''].join('\n')

  writeFileSync(ENV_FILE, content, { mode: OWNER_ONLY_FILE })
  chmodSync(ENV_FILE, OWNER_ONLY_FILE)
}

async function main(): Promise<void> {
  const password = await readPassword()
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Use at most ${MAX_PASSWORD_LENGTH} characters.`)
  }

  writeEnvValue(await hashPassword(password))
  console.log(`Saved to ${ENV_FILE}. Restart the app for it to take effect.`)
  console.log(`When hosting, set ${ENV_KEY} on the host to the value in ${ENV_FILE}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

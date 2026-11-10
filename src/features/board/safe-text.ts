import { IS_DEMO } from '../demo/demo-config'

/**
 * Letters and numbers in any language, spaces, line breaks and everyday
 * punctuation. Leaves out < > ` \ { } and control characters, so nothing
 * typed can form an HTML tag, a script or a template, even if it were ever
 * shown somewhere that doesn't escape it the way React does.
 */
export const SAFE_TEXT_PATTERN =
  /^[\p{L}\p{M}\p{N} \t\r\n.,!?'"‘’“”:;()[\]\-_/&@#%+=*~$^|€£¥₹]*$/u

/** One allowed character, used to find the ones that aren't. */
const SAFE_CHARACTER = /^[\p{L}\p{M}\p{N} \t\r\n.,!?'"‘’“”:;()[\]\-_/&@#%+=*~$^|€£¥₹]$/u

export const SAFE_TEXT_ERROR =
  'Only letters, numbers, spaces and everyday punctuation are allowed.'

/** Only the public demo, which anyone can write to, enforces the rule. */
export const IS_SAFE_TEXT_REQUIRED = IS_DEMO

export function isSafeText(text: string): boolean {
  return SAFE_TEXT_PATTERN.test(text)
}

function shown(character: string): string {
  return /\p{Cc}/u.test(character) ? 'control characters' : character
}

/** The refused characters in the text, each once, in the order they appear. */
export function findUnsafeCharacters(text: string): readonly string[] {
  const refused = [...text].filter((character) => !SAFE_CHARACTER.test(character))
  return [...new Set(refused.map(shown))]
}

/** What to tell the person, or null when the text is fine or the rule is off. */
export function describeUnsafeText(text: string, isRequired = IS_SAFE_TEXT_REQUIRED): string | null {
  if (!isRequired || isSafeText(text)) return null
  return `Remove ${findUnsafeCharacters(text).join(' ')}. ${SAFE_TEXT_ERROR}`
}

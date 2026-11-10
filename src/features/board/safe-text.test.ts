import { describe, expect, it } from 'vitest'
import { describeUnsafeText, findUnsafeCharacters, isSafeText } from './safe-text'

const ATTACKS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  '<a href="javascript:alert(1)">click</a>',
  '<iframe src="https://evil.test"></iframe>',
  '`${alert(1)}`',
  '{{constructor.constructor("alert(1)")()}}',
  '\\u003cscript\\u003e',
  'hello\u0000world',
  '<style>body{display:none}</style>',
]

const EVERYDAY_TEXT = [
  'hello',
  'Hello world 123',
  'alert',
  'Call the bank at 10:30, ask about the fee!',
  'Price: $45.99 (incl. 18% tax) + shipping = $50',
  'Email ana@example.com #urgent',
  "Don't forget: Q3 report - v2.1 / final",
  'Notes\nLine two\n\tindented',
  'Café, naïve, Straße, 東京, नमस्ते, مرحبا',
  '“Smart quotes” and ‘apostrophes’',
  'a*b ~ c^d | e_f [draft]',
  '€12 £10 ¥500 ₹200',
]

describe('isSafeText', () => {
  it.each(ATTACKS)('refuses %s', (attack) => {
    expect(isSafeText(attack)).toBe(false)
  })

  it.each(EVERYDAY_TEXT)('allows %s', (text) => {
    expect(isSafeText(text)).toBe(true)
  })

  it('allows empty text, so notes can be cleared', () => {
    expect(isSafeText('')).toBe(true)
  })
})

describe('findUnsafeCharacters', () => {
  it('lists each refused character once, in order', () => {
    expect(findUnsafeCharacters('<b>bold</b> `x` {y}')).toEqual(['<', '>', '`', '{', '}'])
  })

  it('names control characters instead of printing them', () => {
    expect(findUnsafeCharacters('a\u0007b\u0000c')).toEqual(['control characters'])
  })
})

describe('describeUnsafeText', () => {
  it('says which characters to remove', () => {
    expect(describeUnsafeText('<script>', true)).toBe(
      'Remove < >. Only letters, numbers, spaces and everyday punctuation are allowed.',
    )
  })

  it('says nothing about allowed text', () => {
    expect(describeUnsafeText('hello, alert!', true)).toBeNull()
  })

  it('says nothing where the rule is switched off', () => {
    expect(describeUnsafeText('<b>private site</b>', false)).toBeNull()
  })
})

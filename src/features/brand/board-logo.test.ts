import { describe, expect, it } from 'vitest'
import { BOARD_LOGO_DATA_URLS, boardLogoSvg } from './board-logo'

const THEMES = ['light', 'dark'] as const

describe('board logo', () => {
  it.each(THEMES)('is a self-contained SVG with no scripts, links or fonts (%s)', (theme) => {
    const svg = boardLogoSvg(theme)

    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).not.toMatch(/<script|<text|href=|url\(|on\w+=/i)
  })

  it('draws the dark board with its bright column colours', () => {
    const svg = boardLogoSvg('dark')

    expect(svg).toContain('fill="#2b2018"')
    for (const color of ['#b7ab95', '#ff7a52', '#f0b93f', '#5fd18f']) {
      expect(svg).toContain(`fill="${color}"`)
    }
  })

  it('draws the light board with its paper and deeper column colours', () => {
    const svg = boardLogoSvg('light')

    expect(svg).toContain('fill="#efe7d8"')
    for (const color of ['#5a5548', '#bf3a1b', '#8f6108', '#2b6345']) {
      expect(svg).toContain(`fill="${color}"`)
    }
  })

  it.each(THEMES)('is built in as a data: URL that decodes back to the SVG (%s)', (theme) => {
    const [prefix, encoded] = BOARD_LOGO_DATA_URLS[theme].split(',')

    expect(prefix).toBe('data:image/svg+xml;base64')
    expect(atob(encoded)).toBe(boardLogoSvg(theme))
  })
})

/**
 * The board logo: a tiny version of the board, with its four column colours
 * and cards on the paper. Shapes only, no fonts, so it looks the same
 * everywhere. Each theme gets the colours from board.css, so the browser tab
 * and the MCP server icon match the page. Built in as data: URLs, because
 * every file on the site sits behind the login.
 */

export type LogoTheme = 'light' | 'dark'

interface LogoPalette {
  paper: string
  card: string
  /** Backlog, In progress, In review, Done. */
  columns: readonly [string, string, string, string]
}

const PALETTES: Readonly<Record<LogoTheme, LogoPalette>> = {
  // Light cards are a shade darker than the paper: at 16px the page's own
  // near-white cards would vanish into it.
  light: { paper: '#efe7d8', card: '#cfc2aa', columns: ['#5a5548', '#bf3a1b', '#8f6108', '#2b6345'] },
  dark: { paper: '#2b2018', card: '#f5eddf', columns: ['#b7ab95', '#ff7a52', '#f0b93f', '#5fd18f'] },
}

const CARDS_PER_COLUMN = [3, 2, 1, 2] as const

const SIZE = 64
const MARGIN = 8
const GAP = 2.5
const COLUMN_WIDTH = (SIZE - 2 * MARGIN - 3 * GAP) / 4
// Centred: the rules and the tallest stack span y 16 to 48.
const RULE_Y = 16
const FIRST_CARD_Y = 23
const CARD_HEIGHT = 7
const CARD_STEP = 9

function column(color: string, cards: number, index: number, cardColor: string): string {
  const x = MARGIN + index * (COLUMN_WIDTH + GAP)
  const rule = `<rect x="${x}" y="${RULE_Y}" width="${COLUMN_WIDTH}" height="3" rx="1" fill="${color}"/>`
  const stack = Array.from(
    { length: cards },
    (_, card) =>
      `<rect x="${x}" y="${FIRST_CARD_Y + card * CARD_STEP}" width="${COLUMN_WIDTH}" height="${CARD_HEIGHT}" rx="1.5" fill="${cardColor}"/>`,
  )
  return [rule, ...stack].join('')
}

export function boardLogoSvg(theme: LogoTheme): string {
  const { paper, card, columns } = PALETTES[theme]
  const body = columns.map((color, index) => column(color, CARDS_PER_COLUMN[index], index, card)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="14" fill="${paper}"/>${body}</svg>`
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

export const BOARD_LOGO_DATA_URLS: Readonly<Record<LogoTheme, string>> = {
  light: toDataUrl(boardLogoSvg('light')),
  dark: toDataUrl(boardLogoSvg('dark')),
}

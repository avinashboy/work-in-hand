import { BOARD_LOGO_DATA_URLS } from '../brand/board-logo'

/**
 * MCP clients show one icon on their own background, so the server uses the
 * dark board logo: it reads well on both light and dark client themes.
 */
export const MCP_LOGO_ICON = {
  src: BOARD_LOGO_DATA_URLS.dark,
  mimeType: 'image/svg+xml',
  sizes: ['any'],
} as const

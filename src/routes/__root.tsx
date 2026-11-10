/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { THEME_INIT_SCRIPT } from '../features/board/board-theme'
import { BOARD_LOGO_DATA_URLS } from '../features/brand/board-logo'
import { NotFoundView } from '../features/board/components/NotFoundView'
import boardCss from '../features/board/board.css?url'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      // Every real page sets its own title, so this one only shows on a 404.
      { title: 'Page not found' },
    ],
    links: [
      { rel: 'stylesheet', href: boardCss },
      // Light to start; the theme script below swaps in the dark one.
      { rel: 'icon', type: 'image/svg+xml', href: BOARD_LOGO_DATA_URLS.light },
    ],
    scripts: [{ children: THEME_INIT_SCRIPT }],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundView,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The theme script sets data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// Setting `deny` replaces Vite's list, so its defaults are repeated here.
const VITE_DEFAULT_FS_DENY = [
  '.env',
  '.env.*',
  '*.{crt,pem,key,p12,pfx,cer,der}',
  '.npmrc',
  '.yarnrc.yml',
  '**/.git/**',
]

export default defineConfig({
  server: {
    // The dev server would otherwise hand your data files to any browser.
    fs: {
      deny: [...VITE_DEFAULT_FS_DENY, '.dev.vars', '**/data/*.db*', '**/.wrangler/**'],
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})

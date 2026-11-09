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
    // Database writes must not look like source changes to the dev server.
    watch: { ignored: ['**/data/**'] },
    // The dev server would otherwise hand the database file to any browser.
    fs: { deny: [...VITE_DEFAULT_FS_DENY, '**/data/*.db*'] },
  },
  plugins: [tanstackStart(), viteReact()],
})

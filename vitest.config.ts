import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// Kept apart from vite.config.ts so tests don't boot the TanStack Start plugin.
export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text'],
      include: [
        'src/features/board/board-*.ts',
        'src/features/api/task-api.server.ts',
        'src/features/auth/auth-gate.server.ts',
        'src/features/auth/login-attempts.server.ts',
        'src/features/auth/password-session.server.ts',
        'src/lib/durable-object-sql.server.ts',
      ],
      // These two only run inside Cloudflare's runtime and are thin wrappers.
      exclude: [
        'src/**/*.test.*',
        'src/features/board/board-store.server.ts',
        'src/features/board/board-api.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})

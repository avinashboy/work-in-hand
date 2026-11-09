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
        'src/features/auth/auth-model.ts',
        'src/features/auth/auth-password.server.ts',
        'src/features/auth/auth-service.server.ts',
      ],
      exclude: ['src/**/*.test.*'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})

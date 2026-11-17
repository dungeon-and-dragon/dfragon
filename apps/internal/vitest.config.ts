import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { workspaceAliases } from './workspace-aliases.ts'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['../../packages/ui/test/setup.ts', './src/testing/setup.ts'],
    pool: 'threads'
  }
})

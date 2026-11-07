import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/

export default defineConfig({
  resolve: {
    alias: [
      {
        find: LIBRARY_IMPORT_PATTERN,
        replacement: fileURLToPath(new URL('../../../lib/src/index.ts', import.meta.url))
      }
    ]
  },
  test: {
    include: ['scripts/nickname-evaluation/*.evaluation.ts'],
    fileParallelism: false,
    disableConsoleIntercept: true,
    testTimeout: 30 * 60_000
  }
})

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/
const SHARED_LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

// @dfragon/lib은 dist를 export하므로 build 없이 테스트하도록 source를 읽는다.
export default defineConfig({
  resolve: {
    alias: [
      { find: SHAPE_CHECK_IMPORT_PATTERN, replacement: source('../lib/src/utils/shape-check.ts') },
      { find: SHARED_LIBRARY_IMPORT_PATTERN, replacement: source('../lib/src/index.ts') }
    ]
  },
  test: {
    pool: 'threads'
  }
})

import { fileURLToPath } from 'node:url'
import { stylexOptions } from '@dfragon/ui/stylex-config'
import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/
const SHARED_LIBRARY_IMPORT_PATTERN = /^@dfragon\/lib$/
const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

export default defineConfig({
  // Vitest에는 Vite adapter의 HTTP, HMR timer가 필요 없어 StyleX의 rollup compiler를 쓴다.
  plugins: [stylex.rollup(stylexOptions), react()],
  resolve: {
    alias: [
      { find: SHAPE_CHECK_IMPORT_PATTERN, replacement: source('../lib/src/utils/shape-check.ts') },
      { find: SHARED_LIBRARY_IMPORT_PATTERN, replacement: source('../lib/src/index.ts') },
      { find: SHARED_UI_IMPORT_PATTERN, replacement: source('../ui/src/index.tsx') }
    ]
  },
  test: {
    setupFiles: ['../ui/test/setup.ts', './src/testing/setup/reset-zustand-stores.ts'],
    // 파일마다 child process를 새로 띄우는 forks보다 worker thread가 빠르고, 파일 격리는 유지한다.
    // isolate: false와 vmThreads는 이 suite의 테스트가 깨져 쓰지 않는다.
    pool: 'threads'
  }
})

import { stylexOptions } from '@dfragon/ui/stylex-config'
import stylex from '@stylexjs/unplugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { workspaceAliases } from './workspace-aliases.ts'

export default defineConfig({
  plugins: [stylex.rollup(stylexOptions), react()],
  resolve: { alias: workspaceAliases, dedupe: ['react', 'react-dom'] },
  test: {
    setupFiles: [
      './src/testing/setup/react-act-environment.ts',
      './src/testing/setup/match-media.ts',
      '../../packages/ui/test/setup.ts',
      './src/testing/setup/reset-zustand-stores.ts',
      './src/testing/setup/query-notify.ts'
    ],
    // 파일마다 child process를 새로 띄우는 forks보다 worker thread가 빠르고, 파일 격리는 유지한다.
    // isolate: false와 vmThreads는 이 suite의 테스트가 깨져 쓰지 않는다.
    pool: 'threads'
  }
})

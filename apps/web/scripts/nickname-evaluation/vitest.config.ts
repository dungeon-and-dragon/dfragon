import { defineConfig } from 'vitest/config'
import { workspaceAliases } from '../../workspace-aliases.ts'

export default defineConfig({
  resolve: { alias: workspaceAliases },
  test: {
    include: ['scripts/nickname-evaluation/*.evaluation.ts'],
    fileParallelism: false,
    disableConsoleIntercept: true,
    testTimeout: 30 * 60_000
  }
})

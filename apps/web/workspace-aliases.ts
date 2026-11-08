import { fileURLToPath } from 'node:url'

const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

// @dfragon/ui와 @dfragon/lib은 build 산출물을 export하므로 source로 읽는다.
export const workspaceAliases = [
  { find: SHARED_UI_IMPORT_PATTERN, replacement: source('../../packages/ui/src/index.tsx') },
  { find: LIB_IMPORT_PATTERN, replacement: source('../../packages/lib/src/index.ts') },
  {
    find: SHAPE_CHECK_IMPORT_PATTERN,
    replacement: source('../../packages/lib/src/utils/shape-check.ts')
  }
]

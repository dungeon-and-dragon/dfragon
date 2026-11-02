import { fileURLToPath } from 'node:url'

const SHARED_UI_IMPORT_PATTERN = /^@dfragon\/ui$/
const LIB_IMPORT_PATTERN = /^@dfragon\/lib$/
const OCR_CONTRACT_IMPORT_PATTERN = /^@dfragon\/lib\/ocr-contract$/
const SHAPE_CHECK_IMPORT_PATTERN = /^@dfragon\/lib\/utils\/shape-check$/

function source(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url))
}

// @dfragon/ui와 @dfragon/lib은 build 산출물을 export하므로 source로 읽는다. 웹 앱과 첫 화면 배경을 담은
// @dfragon/client, @dfragon/client-core는 source를 export해 별칭이 필요 없다.
export const workspaceAliases = [
  { find: SHARED_UI_IMPORT_PATTERN, replacement: source('../../packages/ui/src/index.tsx') },
  { find: LIB_IMPORT_PATTERN, replacement: source('../../packages/lib/src/index.ts') },
  {
    find: OCR_CONTRACT_IMPORT_PATTERN,
    replacement: source('../../packages/lib/src/ocr-contract.ts')
  },
  {
    find: SHAPE_CHECK_IMPORT_PATTERN,
    replacement: source('../../packages/lib/src/utils/shape-check.ts')
  }
]

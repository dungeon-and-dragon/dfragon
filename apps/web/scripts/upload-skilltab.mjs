import { execFileSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { parseArgs } from 'node:util'

const BUCKET = 'dfragon-web-ocr'
const INDEX = 'skilltab.json'
const INDEXES = new Set([INDEX, 'oath.json'])
const CONTENT_TYPES = { '.json': 'application/json', '.png': 'image/png' }

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { env: { type: 'string' }, local: { type: 'boolean', default: false } }
})
// 빈 --env는 wrangler처럼 wrangler.jsonc 최상위의 운영 Worker 설정을 가리킨다.
if ((values.env !== '' && values.env !== 'dev') || positionals.length !== 1) {
  throw new Error('Usage: upload-skilltab.mjs --env=<""|dev> [--local] <build-skilltab 출력 폴더>')
}
const [root] = positionals

function put(file) {
  const contentType = CONTENT_TYPES[extname(file)]
  if (contentType === undefined) {
    throw new Error(`No content type for skilltab file: ${file}`)
  }
  execFileSync(
    'wrangler',
    [
      'r2',
      'object',
      'put',
      `${BUCKET}/skilltab/${file}`,
      '--file',
      join(root, file),
      '--content-type',
      contentType,
      `--env=${values.env}`,
      values.local ? '--local' : '--remote'
    ],
    { stdio: ['ignore', process.stderr, 'inherit'] }
  )
}

const files = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort()
if (!files.includes(INDEX)) {
  throw new Error(`${INDEX}이 없습니다: ${root}`)
}

// skilltab.json, oath.json이 새 sprite와 아이콘을 가리키므로, 그림을 모두 올린 뒤에 바꿔야 그 사이에 연 페이지가 없는 그림을
// 받지 않는다.
for (const file of files.filter((file) => !INDEXES.has(file))) {
  put(file)
}
for (const file of files.filter((file) => INDEXES.has(file))) {
  put(file)
}

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const BUCKET = 'dfragon-web-ocr'
const OCR_ROOT = fileURLToPath(new URL('../dist/ocr/', import.meta.url))
const CONTENT_TYPES = {
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
}

const { values } = parseArgs({
  options: { env: { type: 'string' }, local: { type: 'boolean', default: false } }
})
if (values.env !== 'dev') {
  throw new Error('Usage: upload-ocr-assets.mjs --env dev [--local]')
}

const files = (await readdir(OCR_ROOT, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(OCR_ROOT, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .sort()
const hash = createHash('sha256')
for (const file of files) {
  hash.update(file)
  hash.update(await readFile(join(OCR_ROOT, file)))
}
const version = hash.digest('hex').slice(0, 16)

for (const file of files) {
  const contentType = CONTENT_TYPES[extname(file)]
  if (contentType === undefined) {
    throw new Error(`No content type for OCR asset: ${file}`)
  }

  // stdout은 배포 단계가 버전으로 읽으므로 wrangler 출력은 stderr로 보낸다.
  execFileSync(
    'wrangler',
    [
      'r2',
      'object',
      'put',
      `${BUCKET}/ocr/${version}/${file}`,
      '--file',
      join(OCR_ROOT, file),
      '--content-type',
      contentType,
      '--env',
      values.env,
      values.local ? '--local' : '--remote'
    ],
    { stdio: ['ignore', process.stderr, 'inherit'] }
  )
}

process.stdout.write(`${version}\n`)

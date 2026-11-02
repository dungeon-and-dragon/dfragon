import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PNG } from 'pngjs'

const require = createRequire(import.meta.url)
const pngjsRoot = dirname(require.resolve('pngjs/package.json'))

export function syntheticPng(size, pixel) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      png.data.set(pixel(x, y), (y * size + x) * 4)
    }
  }

  return PNG.sync.write(png)
}

export function createIconFixture(t, source) {
  const root = mkdtempSync(join(tmpdir(), 'dfragon-icon-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'assets/brand'), { recursive: true })
  writeFileSync(join(root, 'assets/brand/dfragon.png'), source)
  mkdirSync(join(root, 'node_modules'))
  symlinkSync(pngjsRoot, join(root, 'node_modules/pngjs'), 'junction')
  const favicon = join(root, 'apps/web/public/favicon.png')
  mkdirSync(dirname(favicon), { recursive: true })
  writeFileSync(favicon, '기존 아이콘')
  mkdirSync(join(root, 'scripts'))
  copyFileSync(
    new URL('../../../generate-brand-icons.mjs', import.meta.url),
    join(root, 'scripts/generate-brand-icons.mjs')
  )
  const cwd = join(root, 'unrelated directory')
  mkdirSync(cwd)
  const run = () =>
    spawnSync(process.execPath, [join(root, 'scripts/generate-brand-icons.mjs')], {
      cwd,
      encoding: 'utf8',
      timeout: 10000
    })

  return { root, favicon, cwd, run }
}

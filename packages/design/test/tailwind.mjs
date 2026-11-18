import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { compile } from 'tailwindcss'

const require = createRequire(import.meta.url)
const tailwindRoot = dirname(require.resolve('tailwindcss/package.json'))

async function loadStylesheet(id, basedir) {
  const path = require.resolve(id, { paths: [basedir] })
  const base = dirname(path)
  const content = await readFile(path, 'utf8')

  return { path, base, content }
}

export async function themeCompiler() {
  const theme = await readFile(new URL('../theme.css', import.meta.url), 'utf8')
  const source = `@import 'tailwindcss/theme.css';\n${theme}\n@import 'tailwindcss/utilities.css';`

  return compile(source, { base: tailwindRoot, loadStylesheet })
}

export async function compiledUtilities(candidates) {
  const compiler = await themeCompiler()

  return compiler.build(candidates)
}

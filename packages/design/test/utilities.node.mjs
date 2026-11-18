import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { themeCompiler } from './tailwind.mjs'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const SOURCE_DIRECTORIES = [
  'apps/web/src',
  'apps/internal/src',
  'apps/storybook/src',
  'packages/ui/src'
]
const SOURCE_FILE_PATTERN = /\.tsx?$/
const TEST_FILE_PATTERN = /\.test\./
const CLASS_TOKEN_PATTERN = /[^\s"'`{}<>]+/g

const SCALED_UTILITY_PATTERN =
  /^(?:[^\s:]+:)*(?:-?(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xyse])?|top|right|bottom|left|(?:min-|max-)?[wh]|size|basis|scroll-[pm][xytblrse]?|translate(?:-[xyz])?|indent|leading)-\d+(?:\.\d+)?|(?:min-|max-)?w-(?:3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)|text-[a-z0-9]+\/\d+(?:\.\d+)?)$/

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)

      if (entry.isDirectory()) {
        return sourceFiles(path)
      }

      const isSource = SOURCE_FILE_PATTERN.test(entry.name) && !TEST_FILE_PATTERN.test(entry.name)

      if (isSource) {
        return [path]
      }

      return []
    })
  )

  return nested.flat()
}

async function scaledUtilities() {
  const files = (
    await Promise.all(
      SOURCE_DIRECTORIES.map((directory) => {
        return sourceFiles(join(repositoryRoot, directory))
      })
    )
  ).flat()

  const found = []

  for (const file of files) {
    const lines = (await readFile(file, 'utf8')).split('\n')

    lines.forEach((line, index) => {
      for (const token of line.match(CLASS_TOKEN_PATTERN) ?? []) {
        if (SCALED_UTILITY_PATTERN.test(token)) {
          found.push({ token, place: `${relative(repositoryRoot, file)}:${index + 1}` })
        }
      }
    })
  }

  return found
}

// Tailwind CSS는 모르는 class를 오류 없이 건너뛴다. 후보 하나를 더했는데 결과가 그대로면 CSS가 생기지 않은 것이다.
async function withoutCss(tokens) {
  const compiler = await themeCompiler()
  let css = compiler.build([])
  const missing = new Set()

  for (const token of new Set(tokens)) {
    const next = compiler.build([token])

    if (next === css) {
      missing.add(token)
    }

    css = next
  }

  return missing
}

test('앱 소스의 간격, 크기 utility는 모두 theme.css의 단계라 CSS가 생긴다', async () => {
  const found = await scaledUtilities()
  const missing = await withoutCss(found.map(({ token }) => token))
  const unknown = found
    .filter(({ token }) => missing.has(token))
    .map(({ token, place }) => `${token} → ${place}`)

  assert.deepEqual(unknown, [])
})

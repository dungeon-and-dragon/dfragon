import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const VARIABLE_DEFINITION_PATTERN = /(--[a-z0-9-]+)\s*:/g
const VARIABLE_REFERENCE_PATTERN = /var\((--[a-z0-9-]+)/g
const IMPORT_PATTERN = /@import '\.\/components\/([^']+)'/g
const COLOR_LITERAL_PATTERN = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i

const componentsDirectory = new URL('../components/', import.meta.url)
const theme = await readFile(new URL('../theme.css', import.meta.url), 'utf8')
const entry = await readFile(new URL('../components.css', import.meta.url), 'utf8')
const componentFiles = (await readdir(componentsDirectory)).filter((file) => file.endsWith('.css'))
const components = await Promise.all(
  componentFiles.map(async (file) => {
    const source = await readFile(new URL(file, componentsDirectory), 'utf8')

    return { file, source }
  })
)

function namesOf(source, pattern) {
  return new Set([...source.matchAll(pattern)].map((match) => match[1]))
}

const themeNames = namesOf(theme, VARIABLE_DEFINITION_PATTERN)

test('components.css는 components 폴더의 CSS를 모두 하나씩 불러온다', () => {
  const imported = [...entry.matchAll(IMPORT_PATTERN)].map((match) => match[1])

  assert.deepEqual([...imported].sort(), [...componentFiles].sort())
})

test('컴포넌트 CSS는 theme.css나 같은 파일에서 정의한 변수만 읽는다', () => {
  for (const { file, source } of components) {
    const localNames = namesOf(source, VARIABLE_DEFINITION_PATTERN)
    const unknown = [...namesOf(source, VARIABLE_REFERENCE_PATTERN)].filter(
      (name) => !themeNames.has(name) && !localNames.has(name)
    )

    assert.deepEqual(unknown, [], file)
  }
})

test('컴포넌트 CSS는 색 값을 직접 적지 않는다', () => {
  for (const { file, source } of components) {
    assert.doesNotMatch(source, COLOR_LITERAL_PATTERN, file)
  }
})

import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'

const VARIABLE_DEFINITION_PATTERN = /(--[a-z0-9-]+)\s*:/g
const VARIABLE_REFERENCE_PATTERN = /var\((--[a-z0-9-]+)/g
const IMPORT_PATTERN = /@import '\.\/components\/([^']+)'/g
// Base UI가 positioner, popup, 탭 indicator에 붙이는 변수와 격자 목록의 열 수는 컴포넌트가 실행 중에 정한다.
const RUNTIME_VARIABLES = new Set([
  '--anchor-width',
  '--available-height',
  '--active-tab-left',
  '--active-tab-width',
  '--listbox-columns'
])
const REDUCED_MOTION_RULE_START = '@media (prefers-reduced-motion: reduce) {'
const COLOR_LITERAL_PATTERN = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i
const TRANSPARENT_STATUS_BACKGROUND_PATTERN = /--status-bg:[^;]*transparent/

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

test('컴포넌트 CSS는 theme.css, 같은 파일, 실행 중에 붙는 변수만 읽는다', () => {
  for (const { file, source } of components) {
    const localNames = namesOf(source, VARIABLE_DEFINITION_PATTERN)
    const unknown = [...namesOf(source, VARIABLE_REFERENCE_PATTERN)].filter(
      (name) => !themeNames.has(name) && !localNames.has(name) && !RUNTIME_VARIABLES.has(name)
    )

    assert.deepEqual(unknown, [], file)
  }
})

test('컴포넌트 CSS는 색 값을 직접 적지 않는다', () => {
  for (const { file, source } of components) {
    assert.doesNotMatch(source, COLOR_LITERAL_PATTERN, file)
  }
})

test('상태 칩 면은 행 바탕이 비치지 않게 transparent와 섞지 않는다', async () => {
  const status = await readFile(new URL('status.css', componentsDirectory), 'utf8')

  assert.doesNotMatch(status, TRANSPARENT_STATUS_BACKGROUND_PATTERN)
})

test('동작 줄이기에서 상태 칩 점, 진행 점, 진행 원의 움직임을 끈다', async () => {
  const status = await readFile(new URL('status.css', componentsDirectory), 'utf8')
  const progress = await readFile(new URL('progress.css', componentsDirectory), 'utf8')
  const reducedRules = [status, progress]
    .map((source) => source.slice(source.indexOf(REDUCED_MOTION_RULE_START)))
    .join('\n')

  for (const selector of [
    ".status-chip[data-tone='success'] .status-dot",
    '.step-dots > span',
    '.progress[data-indeterminate]'
  ]) {
    const rule = reducedRules.slice(reducedRules.indexOf(`${selector} {`))
    assert.notEqual(reducedRules.indexOf(`${selector} {`), -1, selector)
    assert.match(rule.slice(0, rule.indexOf('}')), /animation:\s*none/, selector)
  }
})

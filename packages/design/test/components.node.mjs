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
const NARROW_VIEWPORT_RULE_START = '@media (width < 600px) {'
const COLOR_LITERAL_PATTERN = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i
const TRANSPARENT_STATUS_BACKGROUND_PATTERN = /--status-bg:[^;]*transparent/
const CENTERED_LOADING_SEGMENT_PATTERN =
  /\.loading-line > span \{[^}]*left: calc\(50% - 16px\);[^}]*width: 32px;/
const CENTERED_SHORT_LOADING_SEGMENT_PATTERN =
  /\.loading-line-sm > span \{[^}]*left: calc\(50% - 8px\);[^}]*width: 16px;/

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

test('동작 줄이기에서 상태 칩 점과 spinner의 움직임을 끈다', async () => {
  const status = await readFile(new URL('status.css', componentsDirectory), 'utf8')
  const reducedRules = status.slice(status.indexOf(REDUCED_MOTION_RULE_START))

  for (const selector of [".status-chip[data-tone='success'] .status-dot", '.status-spinner']) {
    const rule = reducedRules.slice(reducedRules.indexOf(`${selector} {`))
    assert.notEqual(reducedRules.indexOf(`${selector} {`), -1, selector)
    assert.match(rule.slice(0, rule.indexOf('}')), /animation:\s*none/, selector)
  }
})

test('display.css는 표시 클래스 selector를 모두 정의한다', () => {
  const display = components.find(({ file }) => file === 'display.css').source

  for (const name of [
    'num',
    'label',
    'stat',
    'stat-label',
    'stat-value',
    'portrait',
    'portrait-sm',
    'portrait-md',
    'portrait-lg',
    'link',
    'skeleton',
    'skeleton-text',
    'skeleton-text-xs'
  ]) {
    assert.match(display, new RegExp(`\\.${name}\\s*[,{]`), name)
  }
})

test('base.css는 dl, dd의 기본 margin을 지운다', async () => {
  const base = await readFile(new URL('../base.css', import.meta.url), 'utf8')

  assert.match(base, /dl,\s*dd\s*\{\s*margin:\s*0;/)
})

test('state.css는 상태 자리와 로딩 막대 selector를 모두 정의한다', () => {
  const state = components.find(({ file }) => file === 'state.css').source

  for (const name of ['state', 'state-error', 'state-pending', 'loading-line', 'loading-line-sm']) {
    assert.match(state, new RegExp(`\\.${name}\\s*[,{]`), name)
  }
})

test('로딩 막대의 진행 조각은 움직이지 않을 때 막대 가운데에 있다', () => {
  const state = components.find(({ file }) => file === 'state.css').source

  assert.match(state, CENTERED_LOADING_SEGMENT_PATTERN)
  assert.match(state, CENTERED_SHORT_LOADING_SEGMENT_PATTERN)
})

test('작은 컨트롤의 누르는 영역 pseudo-element는 600px 미만에만 있다', () => {
  const expanded = [
    ['chip.css', '.chip:not(.chip-md)'],
    ['button.css', '.btn-sm'],
    ['icon-button.css', '.icon-btn-sm'],
    ['select.css', '.select-2xs']
  ]

  for (const [file, selector] of expanded) {
    const { source } = components.find((component) => component.file === file)
    const [wide, narrow] = source.split(NARROW_VIEWPORT_RULE_START)

    assert.ok(
      narrow?.includes(`${selector}::before {`),
      `${file}의 ${selector}::before가 600px 미만에 있어야 한다`
    )
    assert.ok(
      !wide.includes(`${selector}::before`),
      `${file}의 ${selector}::before가 600px 이상에 없어야 한다`
    )
  }
})

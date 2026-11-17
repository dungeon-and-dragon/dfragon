import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { test } from 'node:test'
import { compile } from 'tailwindcss'

const VARIABLE_DEFINITION_PATTERN = /(--[a-z0-9-]+)\s*:/g
const REDUCED_MOTION_RULE_START = '@media (prefers-reduced-motion: reduce) {'
const CANVAS_BACKGROUND_UTILITY_PATTERN =
  /\.bg-canvas\s*\{\s*background-color:\s*var\(--color-canvas\)/
const MUTED_TEXT_UTILITY_PATTERN = /\.text-fg-muted\s*\{\s*color:\s*var\(--color-fg-muted\)/
const DEFAULT_RED_UTILITY_PATTERN = /\.bg-red-500/
const DEFAULT_GRAY_UTILITY_PATTERN = /\.bg-gray-500/
const BODY_TEXT_UTILITY_PATTERN =
  /\.text-sm\s*\{\s*font-size:\s*var\(--text-sm\);\s*line-height:\s*var\(--tw-leading, var\(--text-sm--line-height\)\)/
const SEMIBOLD_UTILITY_PATTERN = /\.font-semibold\s*\{/
const MONO_FONT_UTILITY_PATTERN = /\.font-mono\s*\{/
const CONTROL_RADIUS_UTILITY_PATTERN = /\.rounded-control\s*\{/
const NARROW_SCREEN_VARIANT_PATTERN = /@media \(width < 600px\)\s*\{\s*\.max-sm\\:hidden/
const theme = await readFile(new URL('../theme.css', import.meta.url), 'utf8')
const base = await readFile(new URL('../base.css', import.meta.url), 'utf8')

function block(css, start) {
  const index = css.indexOf(`\n${start}`)
  assert.notEqual(index, -1, start)
  const end = css.indexOf('\n}', index)

  return css.slice(index + 1, end)
}

function definedNames(source) {
  return [...source.matchAll(VARIABLE_DEFINITION_PATTERN)].map((match) => match[1])
}

const themeNames = definedNames(block(theme, '@theme static {'))
const primitiveNames = definedNames(block(theme, ':root {'))
const definedThemeNames = [...themeNames, ...primitiveNames]

const require = createRequire(import.meta.url)
const tailwindRoot = dirname(require.resolve('tailwindcss/package.json'))

async function loadStylesheet(id, basedir) {
  const path = require.resolve(id, { paths: [basedir] })
  const base = dirname(path)
  const content = await readFile(path, 'utf8')

  return { path, base, content }
}

async function compiledUtilities(candidates) {
  const source = `@import 'tailwindcss/theme.css';\n${theme}\n@import 'tailwindcss/utilities.css';`
  const compiler = await compile(source, { base: tailwindRoot, loadStylesheet })

  return compiler.build(candidates)
}

test('theme.css의 변수는 한 번만 정의한다', () => {
  assert.equal(new Set(definedThemeNames).size, definedThemeNames.length)
})

test('reduced-motion은 theme.css에 있는 변수만 바꾼다', () => {
  const overrides = definedNames(block(theme, REDUCED_MOTION_RULE_START))
  const unknown = overrides.filter((name) => {
    const isUnknown = !themeNames.includes(name)

    return isUnknown
  })
  assert.deepEqual(unknown, [])
})

test('reduced-motion에서 전환 시간을 모두 0으로 둔다', () => {
  const durations = themeNames.filter((name) => {
    const isDuration = name.startsWith('--duration-')

    return isDuration
  })

  const hasDurations = durations.length > 0
  assert.ok(hasDurations)
  const reduced = block(theme, REDUCED_MOTION_RULE_START)

  for (const name of durations) {
    assert.match(reduced, new RegExp(`${name}:\\s*0ms;`), name)
  }
})

test('기본은 시스템 설정을 따르고 고른 모드는 color-scheme만 고정한다', () => {
  assert.match(block(base, ':root {'), /^\s*color-scheme:\s*light dark;$/m)
  for (const colorMode of ['light', 'dark']) {
    const chosen = block(base, `:root[data-color-mode='${colorMode}'] {`)
    assert.match(chosen, new RegExp(`^\\s*color-scheme:\\s*${colorMode};$`, 'm'))
    assert.deepEqual(definedNames(chosen), [])
  }
})

test('색 utility는 theme.css의 토큰으로만 만든다', async () => {
  const css = await compiledUtilities(['bg-canvas', 'text-fg-muted', 'bg-red-500', 'bg-gray-500'])
  assert.match(css, CANVAS_BACKGROUND_UTILITY_PATTERN)
  assert.match(css, MUTED_TEXT_UTILITY_PATTERN)
  assert.doesNotMatch(css, DEFAULT_RED_UTILITY_PATTERN)
  assert.doesNotMatch(css, DEFAULT_GRAY_UTILITY_PATTERN)
})

test('글자, radius, breakpoint, 곡선 utility는 theme.css의 단계로만 만든다', async () => {
  const css = await compiledUtilities([
    'text-sm',
    'font-semibold',
    'font-mono',
    'rounded-control',
    'max-sm:hidden',
    'text-lg',
    'font-thin',
    'font-serif',
    'rounded-lg',
    'md:hidden',
    'leading-tight',
    'tracking-wide',
    'ease-in'
  ])
  assert.match(css, BODY_TEXT_UTILITY_PATTERN)
  assert.match(css, SEMIBOLD_UTILITY_PATTERN)
  assert.match(css, MONO_FONT_UTILITY_PATTERN)
  assert.match(css, CONTROL_RADIUS_UTILITY_PATTERN)
  assert.match(css, NARROW_SCREEN_VARIANT_PATTERN)
  const defaultSteps = [
    'text-lg',
    'font-thin',
    'font-serif',
    'rounded-lg',
    'md\\\\:hidden',
    'leading-tight',
    'tracking-wide',
    'ease-in'
  ]
  for (const name of defaultSteps) {
    assert.doesNotMatch(css, new RegExp(`\\.${name}\\s*\\{`), name)
  }
})

test('utility를 쓰지 않은 토큰도 CSS 변수로 낸다', async () => {
  const css = await compiledUtilities([])
  for (const name of ['--color-game-fame-label', '--gradient-rarity-mythic', '--beat']) {
    assert.match(css, new RegExp(`${name}:`), name)
  }
})

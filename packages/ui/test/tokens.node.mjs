import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const ALIAS_DECLARATION_PATTERN = /^\s*(--df-[a-z0-9-]+):\s*(.+);$/gm
const VARIABLE_DEFINITION_PATTERN = /^\s*(--[a-z0-9-]+)\s*:/gm
const VARIABLE_REFERENCE_PATTERN = /var\((--[a-z0-9-]+)\)/g
const STYLEX_REFERENCE_PATTERN = /var\((--df-[a-z0-9-]+)\)/g
const ALIAS_VALUE_PATTERN = /^(?:var\(--[a-z0-9-]+\)|calc\(var\(--spacing\) \* \d+\))$/

const tokens = await readFile(new URL('../tokens.css', import.meta.url), 'utf8')
const themeUrl = new URL(import.meta.resolve('@dfragon/design/theme.css'))
const theme = await readFile(themeUrl, 'utf8')
const constants = await readFile(new URL('../src/tokens.stylex.ts', import.meta.url), 'utf8')

function references(source) {
  return [...source.matchAll(VARIABLE_REFERENCE_PATTERN)].map((match) => match[1])
}

const aliases = [...tokens.matchAll(ALIAS_DECLARATION_PATTERN)].map(([, name, value]) => {
  return { name, value }
})
const aliasNames = aliases.map((alias) => alias.name)
const themeNames = [...theme.matchAll(VARIABLE_DEFINITION_PATTERN)].map((match) => match[1])

test('--df-* 별칭은 변수마다 한 번만 정의한다', () => {
  assert.equal(new Set(aliasNames).size, aliasNames.length)
})

test('--df-* 별칭은 값 없이 theme.css의 변수만 가리킨다', () => {
  const literals = aliases.filter((alias) => {
    const isLiteral = !ALIAS_VALUE_PATTERN.test(alias.value)

    return isLiteral
  })
  assert.deepEqual(literals, [])
  const unknown = references(tokens).filter((name) => {
    const isUnknown = !themeNames.includes(name)

    return isUnknown
  })
  assert.deepEqual(unknown, [])
})

test('StyleX 토큰 상수는 tokens.css에 정의된 변수만 참조한다', () => {
  const stylexReferences = [...constants.matchAll(STYLEX_REFERENCE_PATTERN)].map(
    (match) => match[1]
  )
  const hasReferences = stylexReferences.length > 0
  assert.ok(hasReferences)
  const undefinedNames = stylexReferences.filter((name) => {
    const isUndefined = !aliasNames.includes(name)

    return isUndefined
  })
  assert.deepEqual(undefinedNames, [])
})

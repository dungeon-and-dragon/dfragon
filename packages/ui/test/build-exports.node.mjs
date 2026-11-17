import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusChip } from '@dfragon/ui'

const WHITESPACE_PATTERN = /\s+/g

test('공개 ESM entry의 컴포넌트가 디자인 패키지의 클래스와 상태 속성을 붙인다', () => {
  const markup = renderToStaticMarkup(createElement(StatusChip, { tone: 'success' }, '연결됨'))
  const chip = markup.slice(0, markup.indexOf('>'))
  assert.match(chip, /\bdata-tone="success"/)
  assert.match(chip, /\bclass="status-chip status-chip-sm"/)
})

test('소비자 compiler가 공개 토큰 상수로 쓴 StyleX 선언을 산출 CSS의 atomic class로 만든다', async () => {
  const stylesheet = await readFile(
    new URL('../node_modules/.tmp/build-consumer/consumer.css', import.meta.url),
    'utf8'
  )
  const rules = stylesheet.replace(WHITESPACE_PATTERN, '')
  for (const declaration of ['background-color:var(--df-signal)']) {
    const atomicRule = new RegExp(
      `\\.x[a-z0-9]+(?::not\\(#\\\\#\\))*\\{${RegExp.escape(declaration)};?\\}`
    )
    assert.match(rules, atomicRule, declaration)
  }
})

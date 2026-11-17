import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatusChip } from '@dfragon/ui'

test('공개 ESM entry의 컴포넌트가 디자인 패키지의 클래스와 상태 속성을 붙인다', () => {
  const markup = renderToStaticMarkup(createElement(StatusChip, { tone: 'success' }, '연결됨'))
  const chip = markup.slice(0, markup.indexOf('>'))
  assert.match(chip, /\bdata-tone="success"/)
  assert.match(chip, /\bclass="status-chip status-chip-sm"/)
})

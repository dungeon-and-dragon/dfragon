import assert from 'node:assert/strict'
import test from 'node:test'
import { NEOPLE_CHARACTER_SECTIONS } from '@dfragon/neople'
import { characterDetailSections } from '../src/domain/character-detail/sections.js'

test('상세 섹션 목록은 Neople 섹션 표와 같은 섹션을 같은 순서로 담는다', () => {
  assert.deepEqual(characterDetailSections, Object.keys(NEOPLE_CHARACTER_SECTIONS))
})

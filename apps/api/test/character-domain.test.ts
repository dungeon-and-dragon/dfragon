import assert from 'node:assert/strict'
import test from 'node:test'
import { MaleCrusader } from '../src/characters/domain/male-crusader.js'

test('남성 크루세이더는 active나 passive에 용기의 은총이 있을 때만 딜러, 아니면 버퍼다', () => {
  for (const [skillStyle, role] of [
    [{ style: { active: [{ name: '용기의 은총' }], passive: [] } }, 'dealer'],
    [{ style: { active: [], passive: [{ name: '용기의 은총' }] } }, 'dealer'],
    [
      { style: { active: [{ name: '용기의 은총 강화' }], passive: [{ name: '기본기 숙련' }] } },
      'buffer'
    ],
    [{ style: { active: null, passive: ['용기의 은총'] } }, 'buffer'],
    [{ style: null }, 'buffer'],
    [null, 'buffer']
  ] as const) {
    assert.equal(new MaleCrusader(skillStyle).role(), role, JSON.stringify(skillStyle))
  }
})

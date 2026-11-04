import assert from 'node:assert/strict'
import test from 'node:test'
import { MaleCrusader } from '../src/characters/job/male-crusader.js'

test('남성 크루세이더는 active나 passive에 용기의 은총이 있을 때만 딜러다', () => {
  for (const [skillStyle, isDealer] of [
    [{ style: { active: [{ name: '용기의 은총' }], passive: [] } }, true],
    [{ style: { active: [], passive: [{ name: '용기의 은총' }] } }, true],
    [
      { style: { active: [{ name: '용기의 은총 강화' }], passive: [{ name: '기본기 숙련' }] } },
      false
    ],
    [{ style: { active: null, passive: ['용기의 은총'] } }, false],
    [{ style: null }, false],
    [null, false]
  ] as const) {
    assert.equal(new MaleCrusader(skillStyle).isDealer(), isDealer, JSON.stringify(skillStyle))
  }
})

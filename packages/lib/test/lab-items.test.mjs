import assert from 'node:assert/strict'
import test from 'node:test'
import { isSameLabItem, labItemBaseName } from '../dist/lab-items.js'

test('기본 이름은 플래티넘과 레벨 꼬리표를 떼고 공백을 하나로 정리한 이름이다', () => {
  assert.equal(labItemBaseName('프로스트의 전설'), '프로스트의 전설')
  assert.equal(labItemBaseName('프로스트의 전설 플래티넘'), '프로스트의 전설')
  assert.equal(labItemBaseName('프로스트의 전설 플래티넘[100Lv]'), '프로스트의 전설')
  assert.equal(labItemBaseName('종이달 오르골[30Lv]'), '종이달 오르골')
})

test('크리쳐 알처럼 꼬리표가 이름 중간에 끼어도 꼬리표만 떼고 뒤 단어는 남긴다', () => {
  assert.equal(labItemBaseName('합성 여우[45Lv] 알'), '합성 여우 알')
  assert.equal(labItemBaseName('합성 재단사 플래티넘 알'), '합성 재단사 알')
})

test('앞에 공백이 없는 플래티넘과 Lv가 아닌 대괄호는 이름의 일부로 남긴다', () => {
  assert.equal(labItemBaseName('플래티넘 엠블렘'), '플래티넘 엠블렘')
  assert.equal(labItemBaseName('합성 칭호[EVENT]'), '합성 칭호[EVENT]')
})

test('칭호, 크리쳐는 변형 이름도 기본 이름과 같은 아이템으로 보고, 오라와 마법부여 카드는 이름이 같을 때만 같다', () => {
  assert.equal(isSameLabItem('TITLE', '합성 전설 플래티넘[30Lv]', '합성 전설'), true)
  assert.equal(isSameLabItem('CREATURE', '합성 요정[40Lv]', '합성 요정'), true)
  assert.equal(isSameLabItem('TITLE', '합성 전설', '합성 전설 플래티넘[30Lv]'), false)
  assert.equal(isSameLabItem('AURA', '합성 오라 플래티넘', '합성 오라'), false)
  assert.equal(isSameLabItem('WEAPON', '합성 카드[30Lv]', '합성 카드'), false)
  assert.equal(isSameLabItem('AURA', '합성 오라', '합성 오라'), true)
})

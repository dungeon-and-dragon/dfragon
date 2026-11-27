import assert from 'node:assert/strict'
import test from 'node:test'
import { labItemBaseName } from '../dist/lab-items.js'

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

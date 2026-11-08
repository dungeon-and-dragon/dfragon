import { expect, it } from 'vitest'
import { avatarSlotLabel, itemRarityOf } from './character-detail-display'

it('아바타 부위는 slotName 끝의 " 아바타"만 뗀다', () => {
  expect(avatarSlotLabel('목가슴 아바타')).toBe('목가슴')
  expect(avatarSlotLabel('아바타 상자')).toBe('아바타 상자')
  expect(avatarSlotLabel(null)).toBeNull()
})

it('모르는 희귀도 이름은 등급 색 없이 둔다', () => {
  expect(itemRarityOf('태초')).toBe('primordial')
  expect(itemRarityOf('알 수 없음')).toBeNull()
})

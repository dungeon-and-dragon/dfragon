import { describe, expect, it } from 'vitest'
import { avatarSlotLabel, buffOptionLines, itemRarityOf } from './character-detail-display'

describe('버프 스킬 설명 줄', () => {
  it('{valueN}은 values의 N번째 값으로 채우고, 값이 없는 자리는 응답 그대로 둔다', () => {
    expect(
      buffOptionLines({
        level: 1,
        desc: '지속 시간 : {value1}초\n\n힘 증가 : {value2}\n지능 증가 : {value3}',
        values: ['300', '488']
      })
    ).toEqual(['지속 시간 : 300초', '힘 증가 : 488', '지능 증가 : {value3}'])
  })

  it('desc가 없으면 줄이 없다', () => {
    expect(buffOptionLines({ level: 1, desc: null, values: ['300'] })).toEqual([])
  })
})

it('아바타 부위는 slotName 끝의 " 아바타"만 뗀다', () => {
  expect(avatarSlotLabel('목가슴 아바타')).toBe('목가슴')
  expect(avatarSlotLabel('아바타 상자')).toBe('아바타 상자')
  expect(avatarSlotLabel(null)).toBeNull()
})

it('모르는 희귀도 이름은 등급 색 없이 둔다', () => {
  expect(itemRarityOf('태초')).toBe('primordial')
  expect(itemRarityOf('알 수 없음')).toBeNull()
})

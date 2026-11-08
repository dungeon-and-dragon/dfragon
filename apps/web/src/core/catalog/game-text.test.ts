import { expect, it } from 'vitest'
import { gameTextSchema } from './game-text'

it('줄마다 조각의 글자와 tone을 그대로 받는다', () => {
  const lines = [
    [
      { text: '[투룡의 불꽃]', tone: 'increase' },
      { text: ' [장비 발동 옵션]', tone: 'default' }
    ],
    [],
    [{ text: '모든 속도 +20%', tone: 'rarity-primordial' }]
  ]

  expect(gameTextSchema.parse(lines)).toEqual(lines)
})

it('모르는 tone은 기본 색으로 받는다', () => {
  expect(gameTextSchema.parse([[{ text: '새 색', tone: 'rarity-mythic' }]])).toEqual([
    [{ text: '새 색', tone: 'default' }]
  ])
})

it('줄 목록이 아닌 문구는 받지 않는다', () => {
  expect(gameTextSchema.safeParse('모든 속도 +20%').success).toBe(false)
  expect(gameTextSchema.safeParse([[{ text: '색 없음' }]]).success).toBe(false)
})

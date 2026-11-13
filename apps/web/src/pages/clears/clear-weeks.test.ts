import { expect, it } from 'vitest'
import { weekNumberOf } from './clear-weeks'

it('주차는 출시한 주를 1주차로 센다', () => {
  const releasedAt = '2026-08-05T21:00:00.000Z'

  expect(weekNumberOf('2026-08-06', releasedAt)).toBe(1)
  expect(weekNumberOf('2026-11-05', releasedAt)).toBe(14)
  expect(weekNumberOf('2026-12-31', releasedAt)).toBe(22)
})

it('목요일 06:00(KST) 전에 출시한 컨텐츠는 앞 주를 1주차로 센다', () => {
  expect(weekNumberOf('2026-11-05', '2026-11-04T20:59:00.000Z')).toBe(2)
})

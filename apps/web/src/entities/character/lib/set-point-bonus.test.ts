import { expect, it } from 'vitest'
import {
  EQUIPMENT_SET_POINT_BONUS,
  formatSetPointBonus,
  OATH_SET_POINT_BONUS,
  setPointBonusPercent
} from './set-point-bonus'

it.each([
  { point: 2500, bonus: null, label: '없음' },
  { point: 2550, bonus: null, label: '없음' },
  { point: 2619, bonus: null, label: '없음' },
  { point: 2620, bonus: 2, label: '2%' },
  { point: 2689, bonus: 2, label: '2%' },
  { point: 2690, bonus: 4, label: '4%' },
  { point: 2830, bonus: 8, label: '8%' }
])('장비 세트 포인트 $point의 최종 데미지 보너스는 $label이다', ({ point, bonus }) => {
  expect(setPointBonusPercent(point, EQUIPMENT_SET_POINT_BONUS)).toBe(bonus)
})

it.each([
  { point: 2549, bonus: null, label: '없음' },
  { point: 2574, bonus: null, label: '없음' },
  { point: 2575, bonus: 1, label: '1%' },
  { point: 2599, bonus: 1, label: '1%' },
  { point: 2600, bonus: 2, label: '2%' },
  { point: 2780, bonus: 9, label: '9%' }
])('서약 세트 포인트 $point의 최종 데미지 보너스는 $label이다', ({ point, bonus }) => {
  expect(setPointBonusPercent(point, OATH_SET_POINT_BONUS)).toBe(bonus)
})

it('보너스가 있으면 최종 데미지 증가 문구를, 없으면 null을 준다', () => {
  expect(formatSetPointBonus(2780, OATH_SET_POINT_BONUS)).toBe('최종 데미지 +9%')
  expect(formatSetPointBonus(2615, EQUIPMENT_SET_POINT_BONUS)).toBeNull()
})

export type SetPointBonusRule = Readonly<{ base: number; step: number; percentPerStep: number }>

// 저장소 소유자 설명(2026-11-18): 세트 포인트가 2550을 넘으면 장비는 70pt마다 2%, 서약은 25pt마다 1% 최종 데미지가 오른다.
export const EQUIPMENT_SET_POINT_BONUS: SetPointBonusRule = {
  base: 2550,
  step: 70,
  percentPerStep: 2
}
export const OATH_SET_POINT_BONUS: SetPointBonusRule = { base: 2550, step: 25, percentPerStep: 1 }

export function setPointBonusPercent(point: number, rule: SetPointBonusRule): number | null {
  const steps = Math.floor((point - rule.base) / rule.step)

  if (steps <= 0) {
    return null
  }

  return steps * rule.percentPerStep
}

export function formatSetPointBonus(point: number, rule: SetPointBonusRule): string | null {
  const bonus = setPointBonusPercent(point, rule)

  if (bonus === null) {
    return null
  }

  return `최종 데미지 +${bonus}%`
}

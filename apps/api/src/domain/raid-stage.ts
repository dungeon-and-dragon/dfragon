import type { TimelineClear } from './character-timeline/project.js'

// Neople 타임라인은 한 레이드의 본 레이드와 개전, 매칭 같은 단계를 같은 raidName으로 주고 data.modeName으로만 나눈다.
// 표에 없는 modeName은 본 레이드로 보고 하드, 일반으로 나눈다. 값은 운영 DB에서 본 modeName이다(2026-11-09).
const RAID_STAGE_LABELS = new Map([
  ['미카엘라 : 균열서', '싱글/매칭'],
  ['디레지에 : 서막', '매칭'],
  ['무의지의 장벽', '싱글/매칭'],
  ['무의 장막', '개전'],
  ['개전', '개전']
])

// 위 표에 라벨을 더하면 여기에도 더한다. 빠진 라벨은 클리어 집계의 단계별 수에서 맨 뒤로 밀린다.
export const RAID_STAGE_ORDER: readonly string[] = ['싱글/매칭', '매칭', '개전', '일반', '하드']

export function toRaidStageLabel({
  modeName,
  hard
}: Pick<TimelineClear, 'modeName' | 'hard'>): string | null {
  if (modeName === null) {
    return null
  }

  const stageLabel = RAID_STAGE_LABELS.get(modeName)
  if (stageLabel !== undefined) {
    return stageLabel
  }

  const difficultyLabel = hard ? '하드' : '일반'

  return difficultyLabel
}

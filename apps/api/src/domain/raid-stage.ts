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

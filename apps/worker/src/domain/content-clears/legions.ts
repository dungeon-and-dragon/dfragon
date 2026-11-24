import type { StoredClearPopulation } from '@dfragon/database'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'
import type { ClearContent } from '@dfragon/server-core/domain/content-clears/index.js'
import { subWeeks } from 'date-fns'

export type LegionClearMove = {
  legion: ClearContent
  weekStart: Date
  copySnapshot: boolean
}

// 클리어 수집은 그 주 레이드, 레기온 기록을 모두 저장한 뒤 분모를 마감하므로, 레이드 분모가 마감한 주는
// clear_records에 그 주 레기온 기록이 다 있다.
function collectedWeekStarts(
  populations: readonly StoredClearPopulation[],
  legionIds: ReadonlySet<string>
): Date[] {
  const weeks = new Map<number, Date>()

  for (const { contentId, weekStart, closed } of populations) {
    if (closed && !legionIds.has(contentId)) {
      weeks.set(weekStart.getTime(), weekStart)
    }
  }

  return [...weeks.values()]
}

// 막 마감한 주만 클리어 직후라 지금 명성과 점수를 클리어 당시 값으로 복사할 수 있다.
export function planLegionClearMoves(
  legions: readonly ClearContent[],
  populations: readonly StoredClearPopulation[],
  now: Date
): LegionClearMove[] {
  const legionIds = new Set(legions.map(({ id }) => id))
  const closedLegionWeeks = new Set(
    populations
      .filter(({ contentId, closed }) => legionIds.has(contentId) && closed)
      .map(({ contentId, weekStart }) => `${contentId}/${weekStart.getTime()}`)
  )
  const weekStarts = collectedWeekStarts(populations, legionIds)
  const justClosedWeek = subWeeks(startOfResetWeek(now), 1).getTime()

  return legions.flatMap((legion) => {
    const releaseWeek = startOfResetWeek(legion.releasedAt).getTime()

    return weekStarts
      .filter((weekStart) => weekStart.getTime() >= releaseWeek)
      .filter((weekStart) => !closedLegionWeeks.has(`${legion.id}/${weekStart.getTime()}`))
      .map((weekStart) => {
        const copySnapshot = weekStart.getTime() === justClosedWeek

        return { legion, weekStart, copySnapshot }
      })
  })
}

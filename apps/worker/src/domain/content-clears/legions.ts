import type { StoredClearPopulation } from '@dfragon/database'
import { startOfResetWeek } from '@dfragon/server-core/domain/seoul-time.js'
import type { ClearContent } from '@dfragon/server-core/domain/content-clears/index.js'
import { addHours, subHours } from 'date-fns'

// 주를 host 시간대로 더하면 서머타임이 있는 host에서 한 시간 어긋나, 한국 시각의 한 주인 168시간을 더한다.
const WEEK_HOURS = 7 * 24

export type LegionClearMove = {
  legion: ClearContent
  weekStart: Date
  copySnapshot: boolean
}

// 클리어 수집은 그 주 레이드, 레기온 기록을 모두 저장한 뒤 분모를 마감한다. 캐릭터마다 기록을 처음 받을 때
// 베누스 출시부터 받으므로, 레이드 분모가 마감한 가장 최근 주까지는 첫 레이드 출시 전 주의 레기온 기록도 다 있다.
function latestCollectedWeek(
  populations: readonly StoredClearPopulation[],
  legionIds: ReadonlySet<string>
): number | undefined {
  const raidWeeks = populations
    .filter(({ contentId, closed }) => closed && !legionIds.has(contentId))
    .map(({ weekStart }) => weekStart.getTime())

  if (raidWeeks.length === 0) {
    return undefined
  }

  return Math.max(...raidWeeks)
}

function weekStartsBetween(first: number, last: number): Date[] {
  const weekStarts: Date[] = []

  for (let weekStart = new Date(first); weekStart.getTime() <= last; ) {
    weekStarts.push(weekStart)
    weekStart = addHours(weekStart, WEEK_HOURS)
  }

  return weekStarts
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
  const lastWeek = latestCollectedWeek(populations, legionIds)
  const justClosedWeek = subHours(startOfResetWeek(now), WEEK_HOURS).getTime()

  if (lastWeek === undefined) {
    return []
  }

  return legions.flatMap((legion) => {
    const releaseWeek = startOfResetWeek(legion.releasedAt).getTime()

    return weekStartsBetween(releaseWeek, lastWeek)
      .filter((weekStart) => !closedLegionWeeks.has(`${legion.id}/${weekStart.getTime()}`))
      .map((weekStart) => {
        const copySnapshot = weekStart.getTime() === justClosedWeek

        return { legion, weekStart, copySnapshot }
      })
  })
}

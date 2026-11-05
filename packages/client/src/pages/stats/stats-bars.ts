import { CHARACTER_SERVER_NAMES } from '@dfragon/client-core/preload/common/search/character-summary'
import type { CharacterStats } from '@dfragon/client-core/shared/ranking/ranking-stats'
import type { Bar } from './BarCharts'

const FAME_BUCKET_UNIT = 10_000

const seoulTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export function formatComputedAt(computedAt: string): string {
  const parts = Object.fromEntries(
    seoulTime.formatToParts(new Date(computedAt)).map(({ type, value }) => [type, value])
  )

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

export function serverBars({ servers }: CharacterStats): Bar[] {
  return servers.map(({ serverId, count }) => ({
    key: serverId,
    name: CHARACTER_SERVER_NAMES[serverId],
    value: count
  }))
}

export function jobBars({ jobs }: CharacterStats): Bar[] {
  return jobs.map(({ jobId, jobGrowId, jobGrowName, count }) => ({
    key: `${jobId}/${jobGrowId}`,
    name: jobGrowName,
    value: count
  }))
}

export function averageFameBars({ jobs }: CharacterStats): Bar[] {
  return jobs
    .flatMap(({ jobId, jobGrowId, jobGrowName, averageFame }) => {
      if (averageFame == null) {
        return []
      }

      return [{ key: `${jobId}/${jobGrowId}`, name: jobGrowName, value: averageFame }]
    })
    .toSorted((a, b) => b.value - a.value)
}

export function fameBars({ fameDistribution }: CharacterStats): Bar[] {
  return fameDistribution.map(({ from, count }) => ({
    key: String(from),
    name: `${from / FAME_BUCKET_UNIT}만`,
    value: count
  }))
}

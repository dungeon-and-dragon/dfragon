import { CHARACTER_SERVER_NAMES } from '@dfragon/client-core/preload/common/search/character-summary'
import type { CharacterStats } from '@dfragon/client-core/shared/ranking/ranking-stats'
import type { Bar } from './BarCharts'

const FAME_BUCKET_UNIT = 10_000
const AWAKENING_MARK = '眞'

export function serverBars({ servers }: CharacterStats): Bar[] {
  return servers.map(({ serverId, count }) => ({
    key: serverId,
    name: CHARACTER_SERVER_NAMES[serverId],
    value: count
  }))
}

function awakenedJobs({ jobs }: CharacterStats): CharacterStats['jobs'] {
  return jobs.filter(({ jobGrowName }) => jobGrowName.startsWith(AWAKENING_MARK))
}

export function jobBars(stats: CharacterStats): Bar[] {
  return awakenedJobs(stats).map(({ jobId, jobGrowId, jobGrowName, count }) => ({
    key: `${jobId}/${jobGrowId}`,
    name: jobGrowName,
    value: count
  }))
}

export function averageFameBars(stats: CharacterStats): Bar[] {
  return awakenedJobs(stats)
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

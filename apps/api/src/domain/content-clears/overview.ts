import type {
  ClearCoClearCount,
  ClearFameSample,
  ClearJobFameSample,
  ClearRaidTimeCount,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '../seoul-time.js'
import { CLEAR_CONTENTS } from './contents.js'
import { type ClearJobStats, toClearJobKey, toClearJobStats } from './stats.js'

// 캐릭터가 적은 줄의 분위수는 몇 명의 명성을 그대로 드러내므로 분포를 돌려주지 않는다(#1599).
const MIN_DISTRIBUTION_CHARACTERS = 20

// 초기화 주가 목요일 06:00에 시작하므로 ISO 요일(월 1 ~ 일 7)을 목요일부터 놓는다.
const RESET_WEEK_WEEKDAYS = [4, 5, 6, 7, 1, 2, 3]
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

export type ClearFameDistribution = {
  p5: number
  p25: number
  median: number
  p75: number
  p95: number
  max: number
}

export type ClearOverviewJob = ClearJobStats & { fame: ClearFameDistribution | null }

export type ClearOverviewContent = {
  id: string
  cleared: number
  fame: ClearFameDistribution | null
  jobs: ClearOverviewJob[]
  coClears: { id: string; cleared: number }[]
}

export type ClearOverview = {
  weekStart: string | null
  contents: ClearOverviewContent[]
  weekdays: { weekday: number; cleared: number }[]
  hours: { hour: number; cleared: number }[]
}

export type ClearOverviewSamples = {
  fames: readonly ClearFameSample[]
  jobFames: readonly ClearJobFameSample[]
  coClears: readonly ClearCoClearCount[]
  raidTimes: readonly ClearRaidTimeCount[]
}

type FameSample = Pick<ClearFameSample, 'characters' | 'quantiles' | 'max'>

function toFameDistribution({
  characters,
  quantiles,
  max
}: FameSample): ClearFameDistribution | null {
  if (characters < MIN_DISTRIBUTION_CHARACTERS || quantiles === null || max === null) {
    return null
  }

  const [p5, p25, median, p75, p95] = quantiles

  return { p5, p25, median, p75, p95, max }
}

function toOverviewJobs(
  population: StoredClearPopulation,
  samples: readonly ClearJobFameSample[]
): ClearOverviewJob[] {
  const counts = samples.map(({ jobId, jobGrowId, jobName, jobGrowName, cleared }) => ({
    jobId,
    jobGrowId,
    jobName,
    jobGrowName,
    cleared
  }))

  const fames = new Map(
    samples.map((sample) => [toClearJobKey(sample), toFameDistribution(sample)])
  )

  return toClearJobStats(population, counts).map((job) => {
    const fame = fames.get(toClearJobKey(job)) ?? null

    return { ...job, fame }
  })
}

function sumCleared<T extends { cleared: number }>(
  rows: readonly T[],
  matches: (row: T) => boolean
) {
  return rows.reduce((total, row) => (matches(row) ? total + row.cleared : total), 0)
}

export function toEmptyClearOverview(): ClearOverview {
  return { weekStart: null, contents: [], weekdays: [], hours: [] }
}

export function toClearOverview(
  weekStart: Date,
  populations: readonly StoredClearPopulation[],
  { fames, jobFames, coClears, raidTimes }: ClearOverviewSamples
): ClearOverview {
  const weekPopulations = new Map(
    populations
      .filter((population) => population.weekStart.getTime() === weekStart.getTime())
      .map((population) => [population.contentId, population])
  )

  const weekContents = CLEAR_CONTENTS.flatMap(({ id }) => {
    const population = weekPopulations.get(id)

    if (population === undefined) {
      return []
    }

    return [{ id, population }]
  })

  const contentIds = weekContents.map(({ id }) => id)

  const contents = weekContents.map(({ id, population }) => {
    const jobs = toOverviewJobs(
      population,
      jobFames.filter(({ contentId }) => contentId === id)
    )

    const cleared = jobs.reduce((total, job) => total + job.cleared, 0)
    const fameSample = fames.find(({ contentId }) => contentId === id)
    const fame = fameSample !== undefined ? toFameDistribution(fameSample) : null
    const contentCoClears = contentIds
      .filter((otherId) => otherId !== id)
      .map((otherId) => {
        const otherCleared = sumCleared(
          coClears,
          (row) => row.contentId === id && row.otherContentId === otherId
        )

        return { id: otherId, cleared: otherCleared }
      })

    return { id, cleared, fame, jobs, coClears: contentCoClears }
  })

  const weekdays = RESET_WEEK_WEEKDAYS.map((weekday) => {
    const weekdayCleared = sumCleared(raidTimes, (row) => row.weekday === weekday)

    return { weekday, cleared: weekdayCleared }
  })

  const hours = HOURS.map((hour) => {
    const hourCleared = sumCleared(raidTimes, (row) => row.hour === hour)

    return { hour, cleared: hourCleared }
  })

  const resetDate = formatResetDate(weekStart)

  return { weekStart: resetDate, contents, weekdays, hours }
}

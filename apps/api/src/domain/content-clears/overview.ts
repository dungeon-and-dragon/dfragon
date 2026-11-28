import type {
  ClearContentScoreSample,
  ClearFameSample,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearTimeCount,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '@dfragon/server-core/domain/seoul-time.js'
import type { ClearContent } from '@dfragon/server-core/domain/content-clears/index.js'
import {
  type ClearFameDistribution,
  type ClearJobStats,
  type ClearScoreDistributions,
  type ClearTimes,
  toClearJobs,
  toClearTimes,
  toFameDistribution,
  toScoreDistributions
} from './samples.js'

export type ClearOverviewContent = {
  id: string
  cleared: number
  fame: ClearFameDistribution | null
  scores: ClearScoreDistributions
  jobs: ClearJobStats[]
}

export type ClearOverview = ClearTimes & {
  weekStart: string | null
  contents: ClearOverviewContent[]
}

export type ClearOverviewSamples = {
  fames: readonly ClearFameSample[]
  jobFames: readonly ClearJobFameSample[]
  scores: readonly ClearContentScoreSample[]
  jobScores: readonly ClearJobScoreSample[]
  raidTimes: readonly ClearTimeCount[]
}

export function toEmptyClearOverview(): ClearOverview {
  return { weekStart: null, contents: [], weekdays: [], hours: [] }
}

export function toClearOverview(
  shownContents: readonly ClearContent[],
  weekStart: Date,
  populations: readonly StoredClearPopulation[],
  { fames, jobFames, scores, jobScores, raidTimes }: ClearOverviewSamples
): ClearOverview {
  const weekPopulations = new Map(
    populations
      .filter((population) => population.weekStart.getTime() === weekStart.getTime())
      .map((population) => [population.contentId, population])
  )

  const weekContents = shownContents.flatMap(({ id }) => {
    const population = weekPopulations.get(id)

    if (population === undefined) {
      return []
    }

    return [{ id, population }]
  })

  const contents = weekContents.map(({ id, population }) => {
    const jobs = toClearJobs(
      population,
      jobFames.filter(({ contentId }) => contentId === id),
      jobScores.filter(({ contentId }) => contentId === id)
    )

    const cleared = jobs.reduce((total, job) => total + job.cleared, 0)
    const fameSample = fames.find(({ contentId }) => contentId === id)
    const fame = fameSample !== undefined ? toFameDistribution(fameSample) : null
    const contentScores = toScoreDistributions(scores.filter(({ contentId }) => contentId === id))

    return { id, cleared, fame, scores: contentScores, jobs }
  })

  const times = toClearTimes(raidTimes)
  const resetDate = formatResetDate(weekStart)

  return { weekStart: resetDate, contents, ...times }
}

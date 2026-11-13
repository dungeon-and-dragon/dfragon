import type {
  ClearCoClearCount,
  ClearContentScoreSample,
  ClearFameSample,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearTimeCount,
  StoredClearPopulation
} from '@dfragon/database'
import { formatResetDate } from '../seoul-time.js'
import { CLEAR_CONTENTS } from './contents.js'
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
  coClears: { id: string; cleared: number }[]
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
  coClears: readonly ClearCoClearCount[]
  raidTimes: readonly ClearTimeCount[]
}

export function toEmptyClearOverview(): ClearOverview {
  return { weekStart: null, contents: [], weekdays: [], hours: [] }
}

export function toClearOverview(
  weekStart: Date,
  populations: readonly StoredClearPopulation[],
  { fames, jobFames, scores, jobScores, coClears, raidTimes }: ClearOverviewSamples
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
    const jobs = toClearJobs(
      population,
      jobFames.filter(({ contentId }) => contentId === id),
      jobScores.filter(({ contentId }) => contentId === id)
    )

    const cleared = jobs.reduce((total, job) => total + job.cleared, 0)
    const fameSample = fames.find(({ contentId }) => contentId === id)
    const fame = fameSample !== undefined ? toFameDistribution(fameSample) : null
    const contentScores = toScoreDistributions(scores.filter(({ contentId }) => contentId === id))
    const contentCoClears = contentIds
      .filter((otherId) => otherId !== id)
      .map((otherId) => {
        const otherCleared = coClears
          .filter((row) => row.contentId === id && row.otherContentId === otherId)
          .reduce((total, row) => total + row.cleared, 0)

        return { id: otherId, cleared: otherCleared }
      })

    return { id, cleared, fame, scores: contentScores, jobs, coClears: contentCoClears }
  })

  const times = toClearTimes(raidTimes)
  const resetDate = formatResetDate(weekStart)

  return { weekStart: resetDate, contents, ...times }
}

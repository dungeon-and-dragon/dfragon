import type {
  CharacterScoreKind,
  ClearFameQuantiles,
  ClearJobFameSample,
  ClearJobScoreSample,
  ClearScoreSample,
  ClearTimeCount,
  StoredClearPopulation
} from '@dfragon/database'

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

// 장비 점수는 딜러, 버프 점수는 버퍼의 점수라 한 분포에 섞이지 않는다.
export type ClearScoreDistributions = Record<CharacterScoreKind, ClearFameDistribution | null>

export type ClearJobStats = {
  jobId: string | null
  jobGrowId: string | null
  jobName: string | null
  jobGrowName: string | null
  population: number
  cleared: number
  fame: ClearFameDistribution | null
  scores: ClearScoreDistributions
}

export type ClearTimes = {
  weekdays: { weekday: number; cleared: number }[]
  hours: { hour: number; cleared: number }[]
}

export function toFameDistribution({
  characters,
  quantiles,
  max
}: ClearFameQuantiles): ClearFameDistribution | null {
  if (characters < MIN_DISTRIBUTION_CHARACTERS || quantiles === null || max === null) {
    return null
  }

  const [p5, p25, median, p75, p95] = quantiles

  return { p5, p25, median, p75, p95, max }
}

export function toScoreDistributions(
  samples: readonly ClearScoreSample[]
): ClearScoreDistributions {
  const distributionOf = (kind: CharacterScoreKind) => {
    const sample = samples.find((candidate) => candidate.kind === kind)

    if (sample === undefined) {
      return null
    }

    return toFameDistribution(sample)
  }

  const equipment = distributionOf('equipment')
  const buff = distributionOf('buff')

  return { equipment, buff }
}

function toClearJobKey(job: { jobId: string | null; jobGrowId: string | null }): string {
  return JSON.stringify([job.jobId, job.jobGrowId])
}

// 모집단을 저장한 뒤 전직을 바꾼 캐릭터처럼 모집단에 없는 전직의 클리어도 모집단 0으로 넣어, 클리어 수의 합이 그 주 클리어 수와 같게 한다.
export function toClearJobs(
  population: StoredClearPopulation,
  samples: readonly ClearJobFameSample[],
  scoreSamples: readonly ClearJobScoreSample[]
): ClearJobStats[] {
  const noScores = { equipment: null, buff: null }
  const jobs = new Map<string, ClearJobStats>()

  for (const { count, ...job } of population.jobs) {
    jobs.set(toClearJobKey(job), {
      ...job,
      population: count,
      cleared: 0,
      fame: null,
      scores: noScores
    })
  }

  for (const sample of samples) {
    const { jobId, jobGrowId, jobName, jobGrowName, cleared } = sample
    const key = toClearJobKey(sample)
    const stats = jobs.get(key) ?? {
      jobId,
      jobGrowId,
      jobName,
      jobGrowName,
      population: 0,
      cleared: 0,
      fame: null,
      scores: noScores
    }
    const fame = toFameDistribution(sample)

    jobs.set(key, { ...stats, cleared: stats.cleared + cleared, fame })
  }

  return [...jobs.values()].map((job) => {
    const key = toClearJobKey(job)
    const jobScores = scoreSamples.filter((sample) => toClearJobKey(sample) === key)
    const scores = toScoreDistributions(jobScores)

    return { ...job, scores }
  })
}

function sumCleared<T extends { cleared: number }>(
  rows: readonly T[],
  matches: (row: T) => boolean
): number {
  return rows.filter(matches).reduce((total, row) => total + row.cleared, 0)
}

export function toClearTimes(rows: readonly ClearTimeCount[]): ClearTimes {
  const weekdays = RESET_WEEK_WEEKDAYS.map((weekday) => {
    const cleared = sumCleared(rows, (row) => row.weekday === weekday)

    return { weekday, cleared }
  })

  const hours = HOURS.map((hour) => {
    const cleared = sumCleared(rows, (row) => row.hour === hour)

    return { hour, cleared }
  })

  return { weekdays, hours }
}

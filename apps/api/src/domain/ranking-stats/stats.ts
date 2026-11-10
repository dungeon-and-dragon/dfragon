import type { CharacterStats } from '@dfragon/database'
import type { CharacterRow } from '../character-row.js'

export const FAME_RANKING_LIMIT = 100

export type FameRanking = { characters: (CharacterRow & { rank: number })[] }

export type Stats = {
  total: number
  servers: { serverId: string; count: number }[]
  jobs: {
    jobId: string
    jobGrowId: string
    jobName: string
    jobGrowName: string
    count: number
    averageFame: number | null
  }[]
  fameDistribution: { from: number; to: number; count: number }[]
  computedAt: string | null
}

export type SkillStats = {
  minFame: number | null
  sampleSize: number
  skills: { name: string; learned: number; levels: [level: number, count: number][] }[]
  evolutions: { name: string; type1: number; type2: number }[]
  enhancements: { name: string; type1: number; type2: number }[]
  computedAt: string | null
  topCount: number
}

export function roundAverageFame({ jobs, ...counts }: CharacterStats): CharacterStats {
  const roundedJobs = jobs.map(({ averageFame, ...job }) => {
    const roundedFame = averageFame !== null ? Math.round(averageFame) : null

    return { ...job, averageFame: roundedFame }
  })

  return { ...counts, jobs: roundedJobs }
}

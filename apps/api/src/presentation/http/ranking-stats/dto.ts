import type {
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionSnapshot,
  StoredCharacter
} from '@dfragon/database'
import { SKILL_STYLE_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import { z } from 'zod'
import { type CharacterRow, toCharacterRow } from '../../../domain/character-row.js'
import { isMaleCrusaderJob } from '../../../domain/male-crusader.js'

const role = z.enum(['dealer', 'buffer']).optional()

export const fameRankingQuery = z
  .object({
    jobId: z.string().min(1).optional(),
    jobGrowId: z.string().min(1).optional(),
    role
  })
  .refine(({ jobId, jobGrowId }) => jobGrowId === undefined || jobId !== undefined)
  .refine((query) => query.role === undefined || isMaleCrusaderJob(query))

export type FameRankingQuery = z.infer<typeof fameRankingQuery>

export const skillStatsQuery = z
  .object({
    jobId: z.string().min(1),
    jobGrowId: z.string().min(1),
    role
  })
  .refine((query) => query.role === undefined || isMaleCrusaderJob(query))

export type SkillStatsQuery = z.infer<typeof skillStatsQuery>

export type FameRankingResponse = { characters: (CharacterRow & { rank: number })[] }

export type StatsResponse = {
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

export type SkillStatsResponse = {
  minFame: number | null
  sampleSize: number
  skills: { name: string; learned: number; levels: [level: number, count: number][] }[]
  evolutions: { name: string; type1: number; type2: number }[]
  enhancements: { name: string; type1: number; type2: number }[]
  computedAt: string | null
  topCount: number
}

const emptyCharacterStats: CharacterStats = {
  total: 0,
  servers: [],
  jobs: [],
  fameDistribution: []
}

const emptyJobSkillAdoption: JobSkillAdoption = {
  minFame: null,
  sampleSize: 0,
  skills: [],
  evolutions: [],
  enhancements: []
}

export function toFameRankingResponse(characters: readonly StoredCharacter[]): FameRankingResponse {
  const rows = characters.map((character, index) => {
    const rank = index + 1
    const row = toCharacterRow(character)

    return { rank, ...row }
  })

  return { characters: rows }
}

export function toStatsResponse(snapshot: CharacterStatsSnapshot | null): StatsResponse {
  if (snapshot === null) {
    return { ...emptyCharacterStats, computedAt: null }
  }

  const { computedAt: storedAt, ...stats } = snapshot
  const computedAt = storedAt.toISOString()

  return { ...stats, computedAt }
}

export function toSkillStatsResponse(
  snapshot: JobSkillAdoptionSnapshot | null
): SkillStatsResponse {
  if (snapshot === null) {
    return {
      computedAt: null,
      topCount: SKILL_STYLE_SAMPLE_TOP_COUNT,
      ...emptyJobSkillAdoption
    }
  }

  const computedAt = snapshot.computedAt.toISOString()

  return { computedAt, topCount: SKILL_STYLE_SAMPLE_TOP_COUNT, ...snapshot.adoption }
}

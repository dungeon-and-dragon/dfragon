import type {
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionSnapshot,
  CharacterEquipmentSet,
  CharacterOathSet,
  SetAdoption
} from '@dfragon/database'
import { SKILL_STYLE_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import { z } from 'zod'
import { type CharacterRow, toCharacterRow } from '#domain/character-row.js'
import {
  type FameRankingCursor,
  decodeFameRankingCursor,
  encodeFameRankingCursor
} from '#domain/ranking-stats/index.js'
import type { FameRankingPage } from '#application/ranking-stats/index.js'
import { isMaleCrusaderJob } from '@dfragon/server-core/domain/male-crusader.js'

const role = z.enum(['dealer', 'buffer']).optional()

// INTEGER 열과 비교하므로 int 범위를 넘지 않는 9자리까지의 양의 정수만 받는다.
const OATH_SET_ID_PATTERN = /^[1-9]\d{0,8}$/

const jobFilter = {
  jobId: z.string().min(1).optional(),
  jobGrowId: z.string().min(1).optional(),
  role
}
const jobFilterSchema = z.object(jobFilter)

type JobFilter = z.infer<typeof jobFilterSchema>

const hasJobForGrow = ({ jobId, jobGrowId }: JobFilter) =>
  jobGrowId === undefined || jobId !== undefined
const hasMaleCrusaderForRole = (query: JobFilter) =>
  query.role === undefined || isMaleCrusaderJob(query)

const cursor = z.string().transform((value, context): FameRankingCursor => {
  const decoded = decodeFameRankingCursor(value)

  if (decoded === undefined) {
    context.addIssue({ code: 'custom', message: 'cursor를 해석할 수 없음' })

    return z.NEVER
  }

  return decoded
})

export const fameRankingQuery = z
  .object({
    ...jobFilter,
    equipmentSetId: z.string().min(1).optional(),
    oathSetId: z.string().regex(OATH_SET_ID_PATTERN).transform(Number).optional(),
    oathSetOption: z.string().min(1).optional(),
    cursor: cursor.optional()
  })
  .refine(hasJobForGrow)
  .refine(hasMaleCrusaderForRole)
  .refine(({ oathSetId, oathSetOption }) => oathSetOption === undefined || oathSetId !== undefined)

export type FameRankingQuery = z.infer<typeof fameRankingQuery>

export const setStatsQuery = jobFilterSchema.refine(hasJobForGrow).refine(hasMaleCrusaderForRole)

export type SetStatsResponse = Omit<SetAdoption, 'computedAt'> & {
  computedAt: string | null
}

export const skillStatsQuery = z
  .object({
    jobId: z.string().min(1),
    jobGrowId: z.string().min(1),
    role
  })
  .refine((query) => query.role === undefined || isMaleCrusaderJob(query))

export type SkillStatsQuery = z.infer<typeof skillStatsQuery>

export type FameRankingResponse = {
  characters: (CharacterRow & {
    rank: number
    equipmentSet: CharacterEquipmentSet | null
    oathSet: CharacterOathSet | null
  })[]
  nextCursor: string | null
}

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

export function toFameRankingResponse({
  characters,
  nextCursor
}: FameRankingPage): FameRankingResponse {
  const rows = characters.map(({ rank, character }) => {
    const { equipmentSet, oathSet, ...stored } = character
    const row = toCharacterRow(stored)

    return { rank, ...row, equipmentSet, oathSet }
  })
  const encodedCursor = nextCursor !== null ? encodeFameRankingCursor(nextCursor) : null

  return { characters: rows, nextCursor: encodedCursor }
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

export function toSetStatsResponse({ computedAt, ...adoption }: SetAdoption): SetStatsResponse {
  const storedAt = computedAt?.toISOString() ?? null

  return { computedAt: storedAt, ...adoption }
}

import type {
  CharacterStats,
  CharacterStatsSnapshot,
  JobSkillAdoption,
  JobSkillAdoptionSnapshot,
  CharacterEquipmentSet,
  CharacterOathSet,
  ItemAdoption,
  RankingSort,
  SetAdoption
} from '@dfragon/database'
import { SET_SAMPLES, SKILL_STYLE_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import { z } from 'zod'
import { type CharacterRow, toCharacterRow } from '#domain/character-row.js'
import {
  RANKING_SORTS,
  type FameRankingCursor,
  decodeFameRankingCursor,
  encodeFameRankingCursor
} from '#domain/ranking-stats/index.js'
import type { FameRankingPage } from '#application/ranking-stats/index.js'
import { isMaleCrusaderJob } from '@dfragon/server-core/domain/male-crusader.js'

const role = z.enum(['dealer', 'buffer']).optional()

// INTEGER 열과 비교하므로 int 범위를 넘지 않는 9자리까지의 양의 정수만 받는다.
const OATH_SET_ID_PATTERN = /^[1-9]\d{0,8}$/
const RANGE_VALUE_PATTERN = /^(0|[1-9]\d{0,8})$/

const rangeValue = z.string().regex(RANGE_VALUE_PATTERN).transform(Number).optional()

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

const ITEM_IDS_LIMIT = 5

const itemIds = z.string().transform((value, context): string[] => {
  const ids = value.split(',')
  const valid =
    ids.length <= ITEM_IDS_LIMIT &&
    ids.every((id) => id.length > 0) &&
    new Set(ids).size === ids.length

  if (!valid) {
    context.addIssue({ code: 'custom', message: 'itemIds를 해석할 수 없음' })

    return z.NEVER
  }

  return ids
})

// 스킬 이름에는 쉼표와 물결표가 쓰이지 않아(2026-11-19 운영 DB 기준) 쌍은 쉼표, 이름과 종류는 물결표로 나눈다.
// 한 캐릭터가 고르는 개화가 많아야 5개라 쌍도 5개까지 받는다.
const EVOLUTIONS_LIMIT = 5
const EVOLUTION_PATTERN = /^([^~]+)~([12])$/

type EvolutionSelection = { name: string; type: number }

function parseEvolution(pair: string): EvolutionSelection | undefined {
  const matched = EVOLUTION_PATTERN.exec(pair)

  if (matched === null) {
    return undefined
  }

  const [, name, typeDigit] = matched
  const type = Number(typeDigit)

  return { name, type }
}

const evolutions = z.string().transform((value, context): EvolutionSelection[] => {
  const pairs = value.split(',')
  const selections = pairs.map(parseEvolution)
  const parsed = selections.filter((selection) => selection !== undefined)
  const valid =
    pairs.length <= EVOLUTIONS_LIMIT &&
    parsed.length === pairs.length &&
    new Set(parsed.map(({ name }) => name)).size === parsed.length

  if (!valid) {
    context.addIssue({ code: 'custom', message: 'evolutions를 해석할 수 없음' })

    return z.NEVER
  }

  return parsed
})

const cursor = z.string().transform((value, context): FameRankingCursor => {
  const decoded = decodeFameRankingCursor(value)

  if (decoded === undefined) {
    context.addIssue({ code: 'custom', message: 'cursor를 해석할 수 없음' })

    return z.NEVER
  }

  return decoded
})

type RankingRange = {
  sort?: RankingSort
  fameFrom?: number
  fameTo?: number
  scoreFrom?: number
  scoreTo?: number
}

const isWithin = (from: number | undefined, to: number | undefined) =>
  from === undefined || to === undefined || from <= to

function rangeMatchesSort({ sort = 'fame', fameFrom, fameTo, scoreFrom, scoreTo }: RankingRange) {
  if (sort === 'fame') {
    return scoreFrom === undefined && scoreTo === undefined
  }

  return fameFrom === undefined && fameTo === undefined
}

export const fameRankingQuery = z
  .object({
    sort: z.enum(RANKING_SORTS).optional(),
    ...jobFilter,
    equipmentSetId: z.string().min(1).optional(),
    oathSetId: z.string().regex(OATH_SET_ID_PATTERN).transform(Number).optional(),
    oathSetOption: z.string().min(1).optional(),
    itemIds: itemIds.optional(),
    evolutions: evolutions.optional(),
    fameFrom: rangeValue,
    fameTo: rangeValue,
    scoreFrom: rangeValue,
    scoreTo: rangeValue,
    cursor: cursor.optional()
  })
  .refine(hasJobForGrow)
  .refine(hasMaleCrusaderForRole)
  .refine(({ evolutions, jobGrowId }) => evolutions === undefined || jobGrowId !== undefined)
  .refine(({ oathSetId, oathSetOption }) => oathSetOption === undefined || oathSetId !== undefined)
  .refine(({ fameFrom, fameTo }) => isWithin(fameFrom, fameTo))
  .refine(({ scoreFrom, scoreTo }) => isWithin(scoreFrom, scoreTo))
  .refine(rangeMatchesSort)
  .refine(({ sort = 'fame', cursor }) => cursor === undefined || cursor.sort === sort)

export type FameRankingQuery = z.infer<typeof fameRankingQuery>

// 표본을 보내지 않는 예전 화면이 바뀌지 않게 기본값은 전체다.
export const setStatsQuery = z
  .object({ ...jobFilter, sample: z.enum(SET_SAMPLES).default('all') })
  .refine(hasJobForGrow)
  .refine(hasMaleCrusaderForRole)

export const itemStatsQuery = setStatsQuery

export type ItemStatsResponse = Omit<ItemAdoption, 'computedAt'> & {
  computedAt: string | null
}

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
    fameBuckets: { from: number; to: number; count: number }[]
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
  chainSampleSize: number
  chains: { skills: (string | null)[]; count: number }[]
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
  enhancements: [],
  chainSampleSize: 0,
  chains: []
}

export function toFameRankingResponse({
  characters,
  nextCursor
}: FameRankingPage): FameRankingResponse {
  const rows = characters.map(({ equipmentSet, oathSet, ...stored }) => {
    const row = toCharacterRow(stored)

    return { ...row, equipmentSet, oathSet }
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

export function toItemStatsResponse({ computedAt, ...adoption }: ItemAdoption): ItemStatsResponse {
  const storedAt = computedAt?.toISOString() ?? null

  return { computedAt: storedAt, ...adoption }
}

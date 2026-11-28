import type { SetSample } from '@dfragon/lib'
import { z } from 'zod'
import {
  characterIdentitySchema,
  characterRole,
  listScoreSchema,
  type MaleCrusaderRole
} from '#entities/character/@x/ranking'

const nullableText = z.string().nullable()
const count = z.number().int().nonnegative()

export const storedCharacterSchema = characterIdentitySchema.extend({
  characterName: z.string(),
  adventureName: z.string(),
  level: z.number().int().nullable(),
  jobId: nullableText,
  jobGrowId: nullableText,
  jobName: nullableText,
  jobGrowName: nullableText,
  fame: z.number().int().nullable(),
  guildId: nullableText,
  guildName: nullableText,
  role: characterRole,
  score: listScoreSchema
})

export const characterSetsShape = {
  equipmentSet: z.object({ id: z.string(), name: z.string() }).nullable(),
  oathSet: z
    .object({ id: z.number().int(), name: z.string(), option: z.string().nullable() })
    .nullable()
}

export const fameRankingSchema = z.object({
  characters: z.array(storedCharacterSchema.extend(characterSetsShape)),
  nextCursor: z.string().min(1).nullable()
})

const fameBucketSchema = z.object({ from: count, to: count, count })

export const characterStatsSchema = z.object({
  computedAt: z.iso.datetime().nullable(),
  total: count,
  servers: z.array(z.object({ serverId: characterIdentitySchema.shape.serverId, count })),
  jobs: z.array(
    z.object({
      jobId: z.string(),
      jobGrowId: z.string(),
      jobName: z.string(),
      jobGrowName: z.string(),
      count,
      fameBuckets: z.array(fameBucketSchema)
    })
  ),
  fameDistribution: z.array(fameBucketSchema)
})

export type StoredCharacter = z.infer<typeof storedCharacterSchema>
export type FameRanking = z.infer<typeof fameRankingSchema>
export type RankedCharacter = FameRanking['characters'][number]
export type CharacterStats = z.infer<typeof characterStatsSchema>

// 없으면 명성 순이다. 점수 순이면 그 점수가 저장된 캐릭터만 나온다.
export const SCORE_SORTS = ['equipmentScore', 'buffScore'] as const
export type ScoreSort = (typeof SCORE_SORTS)[number]

export type SkillEvolutionType = 1 | 2

export type SkillEvolutionChoice = Readonly<{ name: string; type: SkillEvolutionType }>

/**
 * `jobGrowId`는 `jobId`와 함께, `role`은 남성 크루세이더 전직과 함께만 쓴다.
 * `oathSetOption`은 서약 선택지의 원래 이름이며 `oathSetId`와 함께만 쓴다.
 */
export type FameRankingFilter = Readonly<{
  jobId?: string
  jobGrowId?: string
  role?: MaleCrusaderRole
  equipmentSetId?: string
  oathSetId?: number
  oathSetOption?: string
  // 무기와 유일 장비 itemId다. 모두 낀 캐릭터만 거른다.
  itemIds?: readonly string[]
  // 스킬마다 고른 개화다. jobGrowId와 함께만 쓴다.
  evolutions?: readonly SkillEvolutionChoice[]
  sort?: ScoreSort
  // 둘 다 포함하는 명성 범위다. 명성 순일 때만 쓴다.
  fameFrom?: number
  fameTo?: number
  // 둘 다 포함하는 점수 범위다. 점수 순일 때만 쓴다.
  scoreFrom?: number
  scoreTo?: number
}>

// 개화 필터를 API query와 주소에 같은 \`스킬 이름~종류\` 쌍을 쉼표로 이은 문자열로 둔다.
export function evolutionsQueryText(evolutions: readonly SkillEvolutionChoice[]): string {
  return evolutions.map(({ name, type }) => `${name}~${type}`).join(',')
}

// 표본이 없으면 전체다.
export type SetStatsFilter = Pick<FameRankingFilter, 'jobId' | 'jobGrowId' | 'role'> & {
  sample?: SetSample
}

export type FameRankingSetFilter = Pick<
  FameRankingFilter,
  'equipmentSetId' | 'oathSetId' | 'oathSetOption'
>

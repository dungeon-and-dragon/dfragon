import { z } from 'zod'
import { characterIdentitySchema, characterRole } from '#core/character/character-summary'
import type { MaleCrusaderRole } from '#core/character/male-crusader'

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
  role: characterRole
})

export const fameRankingSchema = z.object({
  characters: z.array(
    storedCharacterSchema.extend({
      rank: z.number().int().positive(),
      equipmentSet: z.object({ id: z.string(), name: z.string() }).nullable(),
      oathSet: z
        .object({ id: z.number().int(), name: z.string(), option: z.string().nullable() })
        .nullable()
    })
  ),
  nextCursor: z.string().min(1).nullable()
})

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
      averageFame: z.number().int().nullable()
    })
  ),
  fameDistribution: z.array(z.object({ from: count, to: count, count }))
})

export type StoredCharacter = z.infer<typeof storedCharacterSchema>
export type FameRanking = z.infer<typeof fameRankingSchema>
export type RankedCharacter = FameRanking['characters'][number]
export type CharacterStats = z.infer<typeof characterStatsSchema>

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
}>

export type SetStatsFilter = Pick<FameRankingFilter, 'jobId' | 'jobGrowId' | 'role'>

export type FameRankingSetFilter = Pick<
  FameRankingFilter,
  'equipmentSetId' | 'oathSetId' | 'oathSetOption'
>

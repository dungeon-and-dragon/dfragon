import { z } from 'zod'
import { characterIdentitySchema } from '../../preload/common/search/character-summary'

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
  guildName: nullableText
})

export const fameRankingSchema = z.object({
  characters: z.array(storedCharacterSchema.extend({ rank: z.number().int().positive() }))
})

export const characterStatsSchema = z.object({
  computedAt: z.iso.datetime(),
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

/** `jobGrowId`는 `jobId`와 함께만 쓴다. */
export type FameRankingFilter = Readonly<{ jobId?: string; jobGrowId?: string }>

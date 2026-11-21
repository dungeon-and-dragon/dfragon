import type { FameRankingPosition, RankingSort } from '@dfragon/database'
import { z } from 'zod'

export const RANKING_SORTS = [
  'fame',
  'equipmentScore',
  'buffScore'
] as const satisfies readonly RankingSort[]

export type FameRankingCursor = FameRankingPosition & {
  sort: RankingSort
}

const cursorSchema = z.tuple([z.enum(RANKING_SORTS), z.int(), z.string().min(1), z.string().min(1)])

export function encodeFameRankingCursor({
  sort,
  value,
  serverId,
  characterId
}: FameRankingCursor): string {
  const json = JSON.stringify([sort, value, serverId, characterId])

  return Buffer.from(json).toString('base64url')
}

export function decodeFameRankingCursor(value: string): FameRankingCursor | undefined {
  let decoded: unknown

  try {
    decoded = JSON.parse(Buffer.from(value, 'base64url').toString())
  } catch {
    return undefined
  }

  const parsed = cursorSchema.safeParse(decoded)

  if (!parsed.success) {
    return undefined
  }

  const [sort, position, serverId, characterId] = parsed.data

  return { sort, value: position, serverId, characterId }
}

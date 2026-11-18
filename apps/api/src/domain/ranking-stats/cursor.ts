import type { FameRankingPosition } from '@dfragon/database'
import { z } from 'zod'

export type FameRankingCursor = FameRankingPosition & {
  rank: number
}

const cursorSchema = z.tuple([z.int(), z.string().min(1), z.string().min(1), z.int().positive()])

export function encodeFameRankingCursor({
  fame,
  serverId,
  characterId,
  rank
}: FameRankingCursor): string {
  const json = JSON.stringify([fame, serverId, characterId, rank])

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

  const [fame, serverId, characterId, rank] = parsed.data

  return { fame, serverId, characterId, rank }
}

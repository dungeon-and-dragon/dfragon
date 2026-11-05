import type { CharacterStats, FameRankingFilter, StoredCharacter } from '@dfragon/database'
import { startOfNextSeoulDay } from '../utils/seoul-time.js'

export const FAME_RANKING_LIMIT = 100

export type FameRanking = {
  characters: (StoredCharacter & { rank: number })[]
}

export type Stats = CharacterStats & { computedAt: string }

export interface RankingStatsReader {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStats(): Promise<CharacterStats>
}

export interface RankingStatsService {
  fameRanking(filter: FameRankingFilter): Promise<FameRanking>
  stats(): Promise<Stats>
}

export function createRankingStatsService(
  reader: RankingStatsReader,
  now: () => Date = () => new Date()
): RankingStatsService {
  let cached: { stats: Stats; expiresAt: Date } | undefined
  let loading: Promise<Stats> | undefined

  const load = async (): Promise<Stats> => {
    const computedAt = now()
    const { jobs, ...counts } = await reader.readCharacterStats()
    const stats = {
      ...counts,
      jobs: jobs.map(({ averageFame, ...job }) => {
        const roundedFame = averageFame !== null ? Math.round(averageFame) : null

        return { ...job, averageFame: roundedFame }
      }),
      computedAt: computedAt.toISOString()
    }
    // 자정 직전에 시작한 집계가 자정 뒤에 끝나도 다음 날 첫 요청이 다시 계산하도록 시작 시각으로 만료를 정한다.
    cached = { stats, expiresAt: startOfNextSeoulDay(computedAt) }

    return stats
  }

  return {
    async fameRanking(filter) {
      const characters = await reader.readFameRanking(filter, FAME_RANKING_LIMIT)

      return {
        characters: characters.map((character, index) => ({ rank: index + 1, ...character }))
      }
    },
    async stats() {
      if (cached !== undefined && now() < cached.expiresAt) {
        return cached.stats
      }
      loading ??= load().finally(() => {
        loading = undefined
      })

      return loading
    }
  }
}

export const emptyRankingStatsReader: RankingStatsReader = {
  readFameRanking: async () => [],
  readCharacterStats: async () => ({ total: 0, servers: [], jobs: [], fameDistribution: [] })
}

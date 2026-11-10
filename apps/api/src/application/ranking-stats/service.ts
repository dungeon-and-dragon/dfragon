import type {
  CharacterStats,
  FameRankingFilter,
  JobSkillAdoption,
  JobSkillAdoptionQuery
} from '@dfragon/database'
import { SKILL_STYLE_SAMPLE_TOP_COUNT } from '@dfragon/lib'
import { toCharacterRow } from '../../domain/character-row.js'
import {
  FAME_RANKING_LIMIT,
  type FameRanking,
  type Stats,
  type SkillStats
} from '../../domain/ranking-stats/stats.js'
import type { RankingStatsReader } from './ports.js'

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

export interface RankingStatsService {
  fameRanking(filter: FameRankingFilter): Promise<FameRanking>
  stats(): Promise<Stats>
  skillStats(job: JobSkillAdoptionQuery): Promise<SkillStats>
}

export function createRankingStatsService(reader: RankingStatsReader): RankingStatsService {
  return {
    async fameRanking(filter) {
      const characters = await reader.readFameRanking(filter, FAME_RANKING_LIMIT)

      const rows = characters.map((character, index) => {
        const rank = index + 1
        const row = toCharacterRow(character)

        return { rank, ...row }
      })

      return { characters: rows }
    },
    async stats() {
      const snapshot = await reader.readCharacterStatsSnapshot()
      if (snapshot === null) {
        return { ...emptyCharacterStats, computedAt: null }
      }
      const { computedAt: storedAt, ...stats } = snapshot
      const computedAt = storedAt.toISOString()

      return { ...stats, computedAt }
    },
    async skillStats(job) {
      const snapshot = await reader.readJobSkillAdoptionSnapshot(job)
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
  }
}

export const emptyRankingStatsReader: RankingStatsReader = {
  readFameRanking: async () => [],
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null
}

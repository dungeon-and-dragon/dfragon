import {
  type CharacterStats,
  type CharacterStatsSnapshot,
  type FameRankingFilter,
  type JobSkillAdoption,
  type JobSkillAdoptionQuery,
  type JobSkillAdoptionSnapshot,
  SKILL_STYLE_SAMPLE_TOP_COUNT,
  type StoredCharacter
} from '@dfragon/database'
import { type CharacterRow, toCharacterRow } from '../domain/character-row.js'

export const FAME_RANKING_LIMIT = 100

export type FameRanking = {
  characters: (CharacterRow & { rank: number })[]
}

export type Stats = CharacterStats & { computedAt: string | null }

export type SkillStats = JobSkillAdoption & { computedAt: string | null; topCount: number }

export interface RankingStatsReader {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStatsSnapshot(): Promise<CharacterStatsSnapshot | null>
  readJobSkillAdoptionSnapshot(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null>
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

export interface RankingStatsService {
  fameRanking(filter: FameRankingFilter): Promise<FameRanking>
  stats(): Promise<Stats>
  skillStats(job: JobSkillAdoptionQuery): Promise<SkillStats>
}

export function roundAverageFame({ jobs, ...counts }: CharacterStats): CharacterStats {
  return {
    ...counts,
    jobs: jobs.map(({ averageFame, ...job }) => {
      const roundedFame = averageFame !== null ? Math.round(averageFame) : null

      return { ...job, averageFame: roundedFame }
    })
  }
}

export function createRankingStatsService(reader: RankingStatsReader): RankingStatsService {
  return {
    async fameRanking(filter) {
      const characters = await reader.readFameRanking(filter, FAME_RANKING_LIMIT)

      return {
        characters: characters.map((character, index) => ({
          rank: index + 1,
          ...toCharacterRow(character)
        }))
      }
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

import {
  type CharacterStats,
  type FameRankingFilter,
  type JobSkillAdoption,
  type JobSkillAdoptionQuery,
  SKILL_STYLE_SAMPLE_TOP_COUNT,
  type StoredCharacter
} from '@dfragon/database'
import { type CharacterRow, toCharacterRow } from '../characters/character-row.js'
import { startOfNextSeoulDay } from '../utils/seoul-time.js'

export const FAME_RANKING_LIMIT = 100

export type FameRanking = {
  characters: (CharacterRow & { rank: number })[]
}

export type Stats = CharacterStats & { computedAt: string }

export type SkillStats = JobSkillAdoption & { computedAt: string; topCount: number }

export interface RankingStatsReader {
  readFameRanking(filter: FameRankingFilter, limit: number): Promise<StoredCharacter[]>
  readCharacterStats(): Promise<CharacterStats>
  readJobSkillAdoption(job: JobSkillAdoptionQuery): Promise<JobSkillAdoption>
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

export function createRankingStatsService(
  reader: RankingStatsReader,
  now: () => Date = () => new Date()
): RankingStatsService {
  let cached: { stats: Stats; expiresAt: Date } | undefined
  let loading: Promise<Stats> | undefined

  const load = async (): Promise<Stats> => {
    const computedAt = now()
    const stats = {
      ...roundAverageFame(await reader.readCharacterStats()),
      computedAt: computedAt.toISOString()
    }
    // 자정 직전에 시작한 집계가 자정 뒤에 끝나도 다음 날 첫 요청이 다시 계산하도록 시작 시각으로 만료를 정한다.
    cached = { stats, expiresAt: startOfNextSeoulDay(computedAt) }

    return stats
  }

  const cachedSkillStats = new Map<string, { skillStats: SkillStats; expiresAt: Date }>()
  const loadingSkillStats = new Map<string, Promise<SkillStats>>()

  const loadSkillStats = async (key: string, job: JobSkillAdoptionQuery): Promise<SkillStats> => {
    const computedAt = now()
    const adoption = await reader.readJobSkillAdoption(job)
    const skillStats = {
      computedAt: computedAt.toISOString(),
      topCount: SKILL_STYLE_SAMPLE_TOP_COUNT,
      ...adoption
    }
    // 명성 있는 캐릭터가 없는 전직은 아무 문자열로 만들 수 있어, 캐시하면 query마다 메모리가 는다.
    if (adoption.minFame !== null) {
      cachedSkillStats.set(key, { skillStats, expiresAt: startOfNextSeoulDay(computedAt) })
    }

    return skillStats
  }

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
      if (cached !== undefined && now() < cached.expiresAt) {
        return cached.stats
      }
      loading ??= load().finally(() => {
        loading = undefined
      })

      return loading
    },
    async skillStats(job) {
      const key = JSON.stringify([job.jobId, job.jobGrowId, job.role ?? null])
      const cachedJob = cachedSkillStats.get(key)
      if (cachedJob !== undefined && now() < cachedJob.expiresAt) {
        return cachedJob.skillStats
      }
      let loadingJob = loadingSkillStats.get(key)
      if (loadingJob === undefined) {
        loadingJob = loadSkillStats(key, job).finally(() => {
          loadingSkillStats.delete(key)
        })
        loadingSkillStats.set(key, loadingJob)
      }

      return loadingJob
    }
  }
}

export const emptyRankingStatsReader: RankingStatsReader = {
  readFameRanking: async () => [],
  readCharacterStats: async () => ({ total: 0, servers: [], jobs: [], fameDistribution: [] }),
  readJobSkillAdoption: async () => ({
    minFame: null,
    sampleSize: 0,
    skills: [],
    evolutions: [],
    enhancements: []
  })
}

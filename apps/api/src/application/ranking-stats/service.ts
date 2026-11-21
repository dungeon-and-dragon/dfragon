import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  ItemAdoption,
  RankedStoredCharacter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  RankingSort,
  SetAdoption,
  SetAdoptionQuery
} from '@dfragon/database'
import { FAME_RANKING_LIMIT, type FameRankingCursor } from '#domain/ranking-stats/index.js'
import type { RankingStatsRepository } from './repository.js'

const emptyItemAdoption: ItemAdoption = { computedAt: null, sampleSize: 0, slots: [] }

const emptySetAdoption: SetAdoption = {
  computedAt: null,
  sampleSize: 0,
  equipmentSets: [],
  oathSets: [],
  combos: []
}

export type FameRankingPage = {
  characters: RankedStoredCharacter[]
  nextCursor: FameRankingCursor | null
}

function sortValue(character: RankedStoredCharacter, sort: RankingSort): number | null {
  if (sort === 'fame') {
    return character.fame
  }

  if (character.score === null) {
    return null
  }

  return character.score.value
}

export class RankingStatsService {
  constructor(private readonly repository: RankingStatsRepository) {}

  // 한 행을 더 읽어 다음 page가 있는지 안다.
  async fameRanking(
    filter: FameRankingFilter,
    cursor?: FameRankingCursor
  ): Promise<FameRankingPage> {
    const sort = filter.sort ?? 'fame'
    const after =
      cursor !== undefined
        ? { value: cursor.value, serverId: cursor.serverId, characterId: cursor.characterId }
        : undefined
    const rows = await this.repository.readFameRanking(filter, FAME_RANKING_LIMIT + 1, after)
    const characters = rows.slice(0, FAME_RANKING_LIMIT)
    const last = characters.at(-1)
    const hasMore = rows.length > FAME_RANKING_LIMIT
    const value = last !== undefined ? sortValue(last, sort) : null

    if (!hasMore || last === undefined || value === null) {
      return { characters, nextCursor: null }
    }

    const { serverId, characterId } = last
    const nextCursor = { sort, value, serverId, characterId }

    return { characters, nextCursor }
  }

  stats(): Promise<CharacterStatsSnapshot | null> {
    return this.repository.readCharacterStatsSnapshot()
  }

  skillStats(job: JobSkillAdoptionQuery): Promise<JobSkillAdoptionSnapshot | null> {
    return this.repository.readJobSkillAdoptionSnapshot(job)
  }

  setStats(query: SetAdoptionQuery): Promise<SetAdoption> {
    return this.repository.readSetAdoption(query)
  }

  itemStats(query: SetAdoptionQuery): Promise<ItemAdoption> {
    return this.repository.readItemAdoption(query)
  }
}

export const emptyRankingStatsRepository: RankingStatsRepository = {
  readFameRanking: async () => [],
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null,
  readSetAdoption: async () => emptySetAdoption,
  readItemAdoption: async () => emptyItemAdoption
}

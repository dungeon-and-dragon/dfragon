import type {
  CharacterStatsSnapshot,
  FameRankingFilter,
  RankedStoredCharacter,
  JobSkillAdoptionQuery,
  JobSkillAdoptionSnapshot,
  SetAdoption,
  SetAdoptionQuery
} from '@dfragon/database'
import { FAME_RANKING_LIMIT, type FameRankingCursor } from '#domain/ranking-stats/index.js'
import type { RankingStatsRepository } from './repository.js'

const emptySetAdoption: SetAdoption = {
  computedAt: null,
  sampleSize: 0,
  equipmentSets: [],
  oathSets: [],
  combos: []
}

export type RankedCharacter = {
  rank: number
  character: RankedStoredCharacter
}

export type FameRankingPage = {
  characters: RankedCharacter[]
  nextCursor: FameRankingCursor | null
}

export class RankingStatsService {
  constructor(private readonly repository: RankingStatsRepository) {}

  // 한 행을 더 읽어 다음 page가 있는지 안다.
  async fameRanking(
    filter: FameRankingFilter,
    cursor?: FameRankingCursor
  ): Promise<FameRankingPage> {
    const after =
      cursor !== undefined
        ? { fame: cursor.fame, serverId: cursor.serverId, characterId: cursor.characterId }
        : undefined
    const rows = await this.repository.readFameRanking(filter, FAME_RANKING_LIMIT + 1, after)
    const page = rows.slice(0, FAME_RANKING_LIMIT)
    const firstRank = (cursor?.rank ?? 0) + 1
    const characters = page.map((character, index) => {
      const rank = firstRank + index

      return { rank, character }
    })
    const last = characters.at(-1)
    const hasMore = rows.length > FAME_RANKING_LIMIT

    if (!hasMore || last === undefined || last.character.fame === null) {
      return { characters, nextCursor: null }
    }

    const { fame, serverId, characterId } = last.character
    const nextCursor = { fame, serverId, characterId, rank: last.rank }

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
}

export const emptyRankingStatsRepository: RankingStatsRepository = {
  readFameRanking: async () => [],
  readCharacterStatsSnapshot: async () => null,
  readJobSkillAdoptionSnapshot: async () => null,
  readSetAdoption: async () => emptySetAdoption
}

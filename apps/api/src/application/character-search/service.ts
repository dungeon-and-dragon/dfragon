import { sortBy } from 'remeda'
import { NeopleSearchFailure } from '../../domain/character-search/failure.js'
import type {
  CharacterCandidatesWithAdventureResult,
  CharacterCandidatesResult,
  CharacterImageCandidate,
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '../../domain/character-search/types.js'
import { type CandidateSource, createCandidateCache } from './candidate-cache.js'
import type { CharacterImageUrl, SearchCharacters } from './ports.js'
import type { CharacterSearchRepository } from './repository.js'

export interface CharacterCandidatesResponse {
  result: CharacterCandidatesWithAdventureResult
  source: CandidateSource
}

const nameCollator = new Intl.Collator('ko')

export class CharacterSearchService {
  private readonly candidateCache = createCandidateCache()
  private closed = false

  constructor(
    private readonly repository: CharacterSearchRepository,
    private readonly searchCharacters: SearchCharacters,
    private readonly characterImageUrl: CharacterImageUrl
  ) {}

  async search(input: NeopleCharacterSearchInput): Promise<CharacterCandidatesResult> {
    const rows = (await this.loadRows(input)).toSorted((left, right) =>
      nameCollator.compare(left.characterName, right.characterName)
    )

    return { rows }
  }

  async candidates(input: NeopleCharacterSearchInput): Promise<CharacterCandidatesResponse> {
    this.assertOpen()

    // 키는 요청 이름 그대로다. Neople match는 대소문자를 무시하지만 후보에는 요청 이름과 정확히 같은 이름만 남는다.

    const { result, source } = await this.candidateCache.get(input.characterName, () =>
      this.loadCandidates(input)
    )

    const named = await this.withAdventureNames(result)

    return { result: named, source }
  }

  async close(): Promise<void> {
    this.closed = true
    this.candidateCache.close()
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new NeopleSearchFailure('internal')
    }
  }

  private async searchNeople(
    input: NeopleCharacterSearchInput
  ): Promise<NeopleCharacterSearchResult> {
    this.assertOpen()

    try {
      return await this.searchCharacters(input)
    } catch (error) {
      if (error instanceof NeopleSearchFailure) {
        throw error
      }
      throw new NeopleSearchFailure('internal', { cause: error })
    }
  }

  private async loadRows(input: NeopleCharacterSearchInput): Promise<CharacterImageCandidate[]> {
    const result = await this.searchNeople(input)

    return result.rows.map((candidate): CharacterImageCandidate => {
      const imageUrl = this.characterImageUrl(candidate)

      return { ...candidate, imageUrl }
    })
  }

  private async loadCandidates(
    input: NeopleCharacterSearchInput
  ): Promise<CharacterCandidatesResult> {
    const rows = sortBy(
      await this.loadRows(input),
      [(row) => row.fame === null, 'asc'],
      [(row) => row.fame ?? 0, 'desc']
    )

    return { rows }
  }

  // 모험단명은 캐시하지 않아 DB에 새로 저장된 모험단명이 캐시된 후보에도 바로 붙는다.
  private async withAdventureNames({
    rows
  }: CharacterCandidatesResult): Promise<CharacterCandidatesWithAdventureResult> {
    const stored = rows.length > 0 ? await this.repository.readAdventureNames(rows) : []
    const names = new Map(
      stored.map(({ serverId, characterId, adventureName }) => [
        `${serverId}/${characterId}`,
        adventureName
      ])
    )

    const candidates = rows.map((row) => {
      const adventureName = names.get(`${row.serverId}/${row.characterId}`) ?? null

      return { ...row, adventureName }
    })

    return { rows: candidates }
  }
}

export const emptyCharacterSearchRepository: CharacterSearchRepository = {
  readAdventureNames: async () => []
}

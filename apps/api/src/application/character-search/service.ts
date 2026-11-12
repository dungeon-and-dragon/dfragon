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
import type { CharacterImageUrl, ReadAdventureNames, SearchCharacters } from './ports.js'

export interface CharacterSearchDependencies {
  readonly searchCharacters: SearchCharacters
  readonly readAdventureNames?: ReadAdventureNames
  readonly characterImageUrl: CharacterImageUrl
}

export interface CharacterCandidatesResponse {
  result: CharacterCandidatesWithAdventureResult
  source: CandidateSource
}

export interface CharacterSearchHttpService {
  search(input: NeopleCharacterSearchInput): Promise<CharacterCandidatesResult>
  candidates(input: NeopleCharacterSearchInput): Promise<CharacterCandidatesResponse>
  close(): Promise<void>
}

const nameCollator = new Intl.Collator('ko')

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const { searchCharacters, readAdventureNames, characterImageUrl } = dependencies
  const candidateCache = createCandidateCache()
  let closed = false

  const assertOpen = (): void => {
    if (closed) {
      throw new NeopleSearchFailure('internal')
    }
  }

  const search = async (
    input: NeopleCharacterSearchInput
  ): Promise<NeopleCharacterSearchResult> => {
    assertOpen()

    try {
      return await searchCharacters(input)
    } catch (error) {
      if (error instanceof NeopleSearchFailure) {
        throw error
      }
      throw new NeopleSearchFailure('internal', { cause: error })
    }
  }

  const loadRows = async (
    input: NeopleCharacterSearchInput
  ): Promise<CharacterImageCandidate[]> => {
    const result = await search(input)

    return result.rows.map((candidate): CharacterImageCandidate => {
      const imageUrl = characterImageUrl(candidate)

      return { ...candidate, imageUrl }
    })
  }

  const loadCandidates = async (
    input: NeopleCharacterSearchInput
  ): Promise<CharacterCandidatesResult> => {
    const rows = sortBy(
      await loadRows(input),
      [(row) => row.fame === null, 'asc'],
      [(row) => row.fame ?? 0, 'desc']
    )

    return { rows }
  }

  // 모험단명은 캐시하지 않아 DB에 새로 저장된 모험단명이 캐시된 후보에도 바로 붙는다.
  const withAdventureNames = async ({
    rows
  }: CharacterCandidatesResult): Promise<CharacterCandidatesWithAdventureResult> => {
    const stored = readAdventureNames && rows.length > 0 ? await readAdventureNames(rows) : []
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

  return {
    async search(input) {
      const rows = (await loadRows(input)).toSorted((left, right) =>
        nameCollator.compare(left.characterName, right.characterName)
      )

      return { rows }
    },
    async candidates(input) {
      assertOpen()

      // 키는 요청 이름 그대로다. Neople match는 대소문자를 무시하지만 후보에는 요청 이름과 정확히 같은 이름만 남는다.

      const { result, source } = await candidateCache.get(input.characterName, () =>
        loadCandidates(input)
      )

      const named = await withAdventureNames(result)

      return { result: named, source }
    },
    async close() {
      closed = true
      candidateCache.close()
    }
  }
}

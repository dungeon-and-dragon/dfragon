import { neopleCharacterImageUrl } from '@dfragon/neople'
import { sortBy } from 'remeda'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import type {
  CharacterCandidatesResult,
  CharacterImageCandidate,
  NeopleCharacterSearchInput,
  NeopleCharacterSearchResult
} from '../types/neople-character-search.js'
import { parseCharacterCandidatesQuery, parseCharacterSearchQuery } from './query.js'
import { createCandidateCache } from './candidate-cache.js'
import type { CharacterSearchDependencies, CharacterSearchHttpService } from './types.js'

const nameCollator = new Intl.Collator('ko')

export function createCharacterSearchService(
  dependencies: CharacterSearchDependencies
): CharacterSearchHttpService {
  const { searchCharacters } = dependencies
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
      const imageUrl = neopleCharacterImageUrl(candidate)

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

  return {
    async search(originalUrl) {
      const input = parseCharacterSearchQuery(originalUrl)
      const rows = (await loadRows(input)).toSorted((left, right) =>
        nameCollator.compare(left.characterName, right.characterName)
      )

      return { rows }
    },
    async candidates(originalUrl) {
      const input = parseCharacterCandidatesQuery(originalUrl)
      assertOpen()

      // 키는 요청 이름 그대로다. Neople match는 대소문자를 무시하지만 후보에는 요청 이름과 정확히 같은 이름만 남는다.

      return candidateCache.get(input.characterName, () => loadCandidates(input))
    },
    async onModuleDestroy() {
      closed = true
      candidateCache.close()
    }
  }
}

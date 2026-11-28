import type { FameRanking } from '#entities/ranking/model/ranking-stats'
import { storyRankedCharacters } from './ranked-characters.fixture'

const PAGE_SIZE = 20
const characters = storyRankedCharacters(PAGE_SIZE * 2 + 5)
const pageCount = 3

export const fameRankingFixture = {
  firstPage: { characters: characters.slice(0, PAGE_SIZE), pageCount },
  secondPage: { characters: characters.slice(PAGE_SIZE, PAGE_SIZE * 2), pageCount },
  lastPage: { characters: characters.slice(PAGE_SIZE * 2), pageCount },
  empty: { characters: [], pageCount: 0 },
  failureMessage: '랭킹을 받지 못했습니다.'
} as const satisfies Record<string, FameRanking | string>

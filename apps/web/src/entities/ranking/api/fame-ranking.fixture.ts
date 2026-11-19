import type { FameRanking } from '#core/ranking'
import { storyRankedCharacters } from '#testing/story-support/story-characters'

const PAGE_SIZE = 100
const characters = storyRankedCharacters(PAGE_SIZE + 30)

export const FAME_RANKING_NEXT_CURSOR = 'fixture-page-2'

export const fameRankingFixture = {
  firstPage: { characters: characters.slice(0, PAGE_SIZE), nextCursor: FAME_RANKING_NEXT_CURSOR },
  lastPage: { characters: characters.slice(PAGE_SIZE), nextCursor: null },
  empty: { characters: [], nextCursor: null },
  failureMessage: '랭킹을 받지 못했습니다.'
} as const satisfies Record<string, FameRanking | string>

import { createContext, useContext } from 'react'
import type {
  CaptureSource,
  RaidFrameResult
} from '@dfragon/client-core/preload/common/types/capture'
import type {
  CharacterIdentity,
  CharacterImage
} from '@dfragon/client-core/preload/common/types/character'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult
} from '@dfragon/client-core/preload/common/types/search'
import type { TodayGrade } from '@dfragon/client-core/preload/common/types/today-grade'
import type {
  AdventureCharacters,
  Guild
} from '@dfragon/client-core/shared/adventure-guild/adventure-guild'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'
import type {
  CharacterSearchQuery,
  SearchedCharacter
} from '@dfragon/client-core/shared/search/character-http'
import type {
  CharacterStats,
  FameRanking,
  FameRankingFilter
} from '@dfragon/client-core/shared/ranking/ranking-stats'
import type { CharacterTimeline } from '@dfragon/client-core/shared/search/character-timeline'
import type { AdventureWeekly } from '@dfragon/client-core/shared/adventure-guild/adventure-weekly'

export type CardSearchHost = SearchApi & {
  notifyOcrCandidatesDetected: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
}

export type PartyCaptureHost = CardSearchHost & {
  selectCaptureSource: (sourceId: string) => Promise<CaptureSource | null>
  readCaptureFrame: () => Promise<CharacterImage>
}

export type RaidCaptureHost = CardSearchHost & {
  readCaptureFrame: () => Promise<RaidFrameResult>
}

export type ClientHost = Readonly<{
  party: PartyCaptureHost
  raid: RaidCaptureHost
  getTodayGrade: () => Promise<TodayGrade>
  getCharacterDetail: (identity: CharacterIdentity) => Promise<CharacterDetailView>
  getCharacterTimeline: (identity: CharacterIdentity) => Promise<CharacterTimeline>
  getFameRanking: (filter: FameRankingFilter) => Promise<FameRanking>
  getCharacterStats: () => Promise<CharacterStats>
  getAdventureCharacters: (adventureName: string) => Promise<AdventureCharacters>
  getGuild: (guildId: string) => Promise<Guild>
  getAdventureWeekly: (adventureName: string) => Promise<AdventureWeekly>
  searchCharacters: (query: CharacterSearchQuery) => Promise<readonly SearchedCharacter[]>
}>

export const ClientHostContext = createContext<ClientHost | null>(null)

export function useClientHost(): ClientHost {
  const host = useContext(ClientHostContext)
  if (host == null) {
    throw new Error('useClientHost는 ClientHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

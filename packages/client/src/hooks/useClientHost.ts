import { createContext, useContext } from 'react'
import type {
  CaptureSource,
  RaidFrameResult
} from '@dfragon/client-core/preload/common/types/capture'
import type {
  CharacterCandidate,
  CharacterIdentity,
  CharacterImage
} from '@dfragon/client-core/preload/common/types/character'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult
} from '@dfragon/client-core/preload/common/types/search'
import type { TodayGrade } from '@dfragon/client-core/preload/common/types/today-grade'
import type { CharacterDetailView } from '@dfragon/client-core/shared/search/character-detail-view'

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

/** `serverId`가 null이면 모든 서버에서 찾는다. */
export type CharacterNameQuery = Readonly<{ characterName: string; serverId: string | null }>

export type ClientHost = Readonly<{
  party: PartyCaptureHost
  raid: RaidCaptureHost
  getTodayGrade: () => Promise<TodayGrade>
  getCharacterDetail: (identity: CharacterIdentity) => Promise<CharacterDetailView>
  searchCharacters: (query: CharacterNameQuery) => Promise<readonly CharacterCandidate[]>
}>

export const ClientHostContext = createContext<ClientHost | null>(null)

export function useClientHost(): ClientHost {
  const host = useContext(ClientHostContext)
  if (host == null) {
    throw new Error('useClientHost는 ClientHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

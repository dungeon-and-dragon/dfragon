import { createContext, useContext } from 'react'
import type {
  CaptureSource,
  RaidFrameResult
} from '#features/capture-search/lib/capture/capture-types'
import type { CharacterImage } from '#entities/character'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult
} from '#features/capture-search/lib/search/search'

import type { ScreenWatchKind } from '#features/capture-search/lib/screen-watch/screen-watch'

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
}>

export type WatchedScreen = Readonly<{ kind: ScreenWatchKind; roundRunning: boolean }>

export type AutoRoundSignal = Readonly<{ kind: ScreenWatchKind }>

export type BrowserHost = ClientHost & {
  onPastedFrame: (listener: () => void) => () => void
  requestScreenShare: () => Promise<string | null>
  onScreenShareEnded: (listener: () => void) => () => void
  setWatchedScreen: (screen: WatchedScreen) => void
  // listener는 회차를 시작했는지 돌려준다. 시작하지 않으면 host가 그 회차용으로 든 프레임을 놓는다.
  onAutoRound: (listener: (signal: AutoRoundSignal) => boolean) => () => void
}

export const ClientHostContext = createContext<ClientHost | null>(null)

export const BrowserHostContext = createContext<BrowserHost | null>(null)

export function useBrowserHost(): BrowserHost {
  const host = useContext(BrowserHostContext)
  if (host == null) {
    throw new Error('useBrowserHost는 BrowserHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

export function useClientHost(): ClientHost {
  const host = useContext(ClientHostContext)
  if (host == null) {
    throw new Error('useClientHost는 ClientHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

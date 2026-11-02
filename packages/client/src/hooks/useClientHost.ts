import { createContext, useContext } from 'react'
import type {
  CaptureSource,
  RaidFrameResult,
  WindowFrameResult
} from '@dfragon/client-core/preload/common/types/capture'
import type {
  OcrSearchObservation,
  SearchApi,
  SearchCommandResult
} from '@dfragon/client-core/preload/common/types/search'
import type { TodayGrade } from '@dfragon/client-core/preload/common/types/today-grade'

export type PageShortcut = 'restart-search' | 'take-snapshot' | 'copy-clipboard'

export type CardSearchHost = SearchApi & {
  notifyOcrCandidatesDetected: (observation: OcrSearchObservation) => Promise<SearchCommandResult>
}

export type PartyCaptureHost = CardSearchHost & {
  selectCaptureSource: (sourceId: string) => Promise<CaptureSource | null>
  readCaptureFrame: () => Promise<WindowFrameResult>
}

export type RaidCaptureHost = CardSearchHost & {
  readCaptureFrame: () => Promise<RaidFrameResult>
}

export type ClientHost = Readonly<{
  party: PartyCaptureHost
  raid: RaidCaptureHost
  onShortcut: (listener: (shortcut: PageShortcut) => void) => () => void
  getTodayGrade: () => Promise<TodayGrade>
}>

export const ClientHostContext = createContext<ClientHost | null>(null)

export function useClientHost(): ClientHost {
  const host = useContext(ClientHostContext)
  if (host == null) {
    throw new Error('useClientHost는 ClientHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

import type { CharacterCatalog } from '../character-catalog/ports.js'
import type { CalculateScore, FetchCharacterDetails } from '../character-detail/ports.js'

export type ScoreEngineHandle = {
  calculate: CalculateScore
  isRunning(): boolean
  close(): Promise<void>
}

export type ScoreSources = {
  fetchDetails: FetchCharacterDetails
  catalog: CharacterCatalog
}

export type ScoreSourceEvents = {
  onRequest: () => void
  /** 아이템 상세 요청이 한도 초과, 점검, timeout으로 실패했다. 아이템 행이 없는 응답은 여기에 들지 않는다. */
  onItemLookupUnavailable: () => void
}

export type ScoreCalculationPorts = {
  /** 라이브러리 경로 설정이 없으면 null이다. */
  openEngine: () => ScoreEngineHandle | null
  /** 실행마다 아이템 상세 캐시를 새로 둔다. */
  createSources: (events: ScoreSourceEvents) => ScoreSources
  readConcurrency: () => number
  now: () => Date
  pause: (ms: number) => Promise<void>
  report: (code: string, details: Readonly<Record<string, string | number>>) => void
}

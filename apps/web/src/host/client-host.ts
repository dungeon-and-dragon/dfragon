import { createContext, useContext } from 'react'
import type { CaptureSource, RaidFrameResult } from '#core/capture/capture-types'
import type { CharacterIdentity, CharacterImage } from '#core/character/character'
import type { OcrSearchObservation, SearchApi, SearchCommandResult } from '#core/search/search'
import type { TodayGrade } from '#core/today-grade/today-grade-types'
import type { Guild } from '#core/adventure-guild/adventure-guild'
import type { CharacterDetailView } from '#core/character/character-detail-view'
import type { OathCatalog } from '#core/catalog/oath-catalog'
import type { CharacterSearchQuery, SearchedCharacter } from '#core/api/character-schemas'
import type { CharacterStats, FameRanking, FameRankingFilter } from '#core/ranking/ranking-stats'
import type { SkillStats, SkillStatsJob } from '#core/ranking/skill-stats'
import type {
  CharacterTimeline,
  TimelineAcquisition,
  TimelineEnhancement,
  TimelinePage
} from '#core/character/character-timeline'
import type { SkillWindowCatalog } from '#core/catalog/skill-window'
import type { AdventureWeekly } from '#core/adventure-guild/adventure-weekly'
import type {
  ActivitySeason,
  AdventureActivity,
  AdventureActivitySeasonDays
} from '#core/adventure-guild/adventure-activity'

import type { ScreenWatchKind } from './screen-watch/screen-watch'

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
  refreshCharacterDetail: (identity: CharacterIdentity) => Promise<CharacterDetailView>
  getCharacterTimeline: (identity: CharacterIdentity) => Promise<CharacterTimeline>
  getTimelineEnhancements: (
    identity: CharacterIdentity,
    before: string
  ) => Promise<TimelinePage<TimelineEnhancement>>
  getTimelineAcquisitions: (
    identity: CharacterIdentity,
    before: string
  ) => Promise<TimelinePage<TimelineAcquisition>>
  // 스킬 창 데이터를 아직 올리지 않았거나 그 직업이 데이터에 없으면 null을 돌려준다.
  getSkillWindowCatalog: (jobName: string) => Promise<SkillWindowCatalog | null>
  // 서약 데이터를 아직 올리지 않았으면 null을 돌려준다.
  getOathCatalog: () => Promise<OathCatalog | null>
  getFameRanking: (filter: FameRankingFilter) => Promise<FameRanking>
  getCharacterStats: () => Promise<CharacterStats>
  getSkillStats: (job: SkillStatsJob) => Promise<SkillStats>
  getGuild: (guildId: string) => Promise<Guild>
  getAdventureWeekly: (adventureName: string) => Promise<AdventureWeekly>
  getAdventureActivity: (
    adventureName: string,
    season: number | undefined
  ) => Promise<AdventureActivity>
  getAdventureActivitySeasonDays: (
    adventureName: string,
    season: number
  ) => Promise<AdventureActivitySeasonDays>
  backfillAdventureSeason: (adventureName: string, season: number) => Promise<ActivitySeason>
  searchCharacters: (query: CharacterSearchQuery) => Promise<readonly SearchedCharacter[]>
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

export function useClientHost(): ClientHost {
  const host = useContext(ClientHostContext)
  if (host == null) {
    throw new Error('useClientHost는 ClientHostContext 안에서만 쓸 수 있습니다.')
  }

  return host
}

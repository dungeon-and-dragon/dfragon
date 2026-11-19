import type { ClientHost } from '#host/client-host'

type StoryHostOverrides = Partial<Omit<ClientHost, 'party' | 'raid'>> & {
  party?: Partial<ClientHost['party']>
  raid?: Partial<ClientHost['raid']>
}

// Storybook은 vitest의 mock을 쓸 수 없어, story가 넘기지 않은 연산은 끝나지 않는 Promise로 채워 받는 중 상태로 둔다.
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

function unsubscribe(): void {}

export function createStoryClientHost({
  party,
  raid,
  ...operations
}: StoryHostOverrides = {}): ClientHost {
  return {
    party: {
      controlCharacterSearch: pending,
      onCharacterSearchChanged: () => unsubscribe,
      notifyOcrCandidatesDetected: pending,
      selectCaptureSource: pending,
      readCaptureFrame: pending,
      ...party
    },
    raid: {
      controlCharacterSearch: pending,
      onCharacterSearchChanged: () => unsubscribe,
      notifyOcrCandidatesDetected: pending,
      readCaptureFrame: pending,
      ...raid
    },
    getTodayGrade: pending,
    getCharacterDetail: pending,
    refreshCharacterDetail: pending,
    getCharacterTimeline: pending,
    getTimelineEnhancements: pending,
    getTimelineAcquisitions: pending,
    getCharacterHistory: pending,
    getCharacterHistorySnapshot: pending,
    getSkillWindowCatalog: pending,
    getOathCatalog: pending,
    getFameRanking: pending,
    getCharacterStats: pending,
    getSkillStats: pending,
    getSetStats: pending,
    getItemStats: pending,
    getClearStats: pending,
    getClearContentStats: pending,
    getClearOverview: pending,
    getGuild: pending,
    getAdventureWeekly: pending,
    getAdventureActivity: pending,
    getAdventureActivitySeasonDays: pending,
    backfillAdventureSeason: pending,
    searchCharacters: pending,
    ...operations
  }
}

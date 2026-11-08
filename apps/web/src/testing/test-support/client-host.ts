import { vi } from 'vitest'
import { searchSnapshot } from '#core/testing/fixtures/search-test-fixture'
import type { TodayGrade } from '#core/types/today-grade'
import { SEARCH_SLOT_COUNTS } from '#core/types/search'
import type { ClientHost } from '../../host/client-host'
import { emptySearchSlots } from '#core/lib/slots'

type ClientHostOverrides = Partial<
  Pick<
    ClientHost,
    | 'getTodayGrade'
    | 'getCharacterDetail'
    | 'getCharacterTimeline'
    | 'getTimelineEnhancements'
    | 'getTimelineAcquisitions'
    | 'getSkillWindowCatalog'
    | 'getOathCatalog'
    | 'getFameRanking'
    | 'getCharacterStats'
    | 'getSkillStats'
    | 'getGuild'
    | 'getAdventureWeekly'
    | 'getAdventureActivity'
    | 'getAdventureActivityDay'
    | 'backfillAdventureSeason'
    | 'searchCharacters'
  >
> & {
  party?: Partial<ClientHost['party']>
  raid?: Partial<ClientHost['raid']>
}

// 테스트가 넘기지 않은 연산은 실제 계약처럼 Promise를 돌려주는 mock으로 채운다. 프레임 읽기는 끝나지 않는다.
export function createTestClientHost({
  party,
  raid,
  ...operations
}: ClientHostOverrides = {}): ClientHost {
  return {
    party: {
      controlCharacterSearch: vi.fn(async () => ({
        ok: true as const,
        snapshot: searchSnapshot()
      })),
      onCharacterSearchChanged: vi.fn(() => () => {}),
      notifyOcrCandidatesDetected: vi.fn(async () => ({
        ok: true as const,
        snapshot: searchSnapshot()
      })),
      selectCaptureSource: vi.fn(async () => null),
      readCaptureFrame: vi.fn(() => new Promise<never>(() => {})),
      ...party
    },
    raid: {
      controlCharacterSearch: vi.fn(async () => ({
        ok: true as const,
        snapshot: searchSnapshot({ slots: emptySearchSlots(SEARCH_SLOT_COUNTS.raid) })
      })),
      onCharacterSearchChanged: vi.fn(() => () => {}),
      notifyOcrCandidatesDetected: vi.fn(async () => ({
        ok: true as const,
        snapshot: searchSnapshot({ slots: emptySearchSlots(SEARCH_SLOT_COUNTS.raid) })
      })),
      readCaptureFrame: vi.fn(() => new Promise<never>(() => {})),
      ...raid
    },
    getTodayGrade: vi.fn(() => new Promise<TodayGrade>(() => {})),
    getCharacterDetail: vi.fn(() => new Promise<never>(() => {})),
    getCharacterTimeline: vi.fn(() => new Promise<never>(() => {})),
    getTimelineEnhancements: vi.fn(() => new Promise<never>(() => {})),
    getTimelineAcquisitions: vi.fn(() => new Promise<never>(() => {})),
    getSkillWindowCatalog: vi.fn(async () => null),
    getOathCatalog: vi.fn(async () => null),
    getFameRanking: vi.fn(() => new Promise<never>(() => {})),
    getCharacterStats: vi.fn(() => new Promise<never>(() => {})),
    getSkillStats: vi.fn(() => new Promise<never>(() => {})),
    getGuild: vi.fn(() => new Promise<never>(() => {})),
    getAdventureWeekly: vi.fn(() => new Promise<never>(() => {})),
    getAdventureActivity: vi.fn(() => new Promise<never>(() => {})),
    getAdventureActivityDay: vi.fn(() => new Promise<never>(() => {})),
    backfillAdventureSeason: vi.fn(() => new Promise<never>(() => {})),
    searchCharacters: vi.fn(() => new Promise<never>(() => {})),
    ...operations
  }
}

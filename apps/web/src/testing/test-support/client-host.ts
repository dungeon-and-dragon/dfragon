import { vi } from 'vitest'
import { searchSnapshot } from '#core/testing'
import type { TodayGrade } from '#core/today-grade'
import { SEARCH_SLOT_COUNTS } from '#core/search'
import type { ClientHost } from '#host/client-host'
import { emptySearchSlots } from '#core/capture'

type ClientHostOverrides = Partial<
  Pick<
    ClientHost,
    | 'getTodayGrade'
    | 'getGuild'
    | 'getAdventureWeekly'
    | 'getAdventureActivity'
    | 'getAdventureActivitySeasonDays'
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
    getGuild: vi.fn(() => new Promise<never>(() => {})),
    getAdventureWeekly: vi.fn(() => new Promise<never>(() => {})),
    getAdventureActivity: vi.fn(() => new Promise<never>(() => {})),
    getAdventureActivitySeasonDays: vi.fn(() => new Promise<never>(() => {})),
    backfillAdventureSeason: vi.fn(() => new Promise<never>(() => {})),
    searchCharacters: vi.fn(() => new Promise<never>(() => {})),
    ...operations
  }
}

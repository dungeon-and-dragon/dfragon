import { vi } from 'vitest'
import { emptySearchSlots } from '#features/capture-search/lib/capture/slots'
import { SEARCH_SLOT_COUNTS } from '#features/capture-search/lib/search/search'
import type { ClientHost } from '#features/capture-search/model/client-host'
import { searchSnapshot } from './search.fixture'

type ClientHostOverrides = {
  party?: Partial<ClientHost['party']>
  raid?: Partial<ClientHost['raid']>
}

// 테스트가 넘기지 않은 연산은 실제 계약처럼 Promise를 돌려주는 mock으로 채운다. 프레임 읽기는 끝나지 않는다.
export function createTestClientHost({ party, raid }: ClientHostOverrides = {}): ClientHost {
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
    }
  }
}

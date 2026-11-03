import type { SlotCard } from '@dfragon/client-core/lib/slot-cards'

export const LOOKUP_STEPS = ['이름 인식', '캐릭터 검색', '상세 정보 확인'] as const
export type LookupStep = (typeof LOOKUP_STEPS)[number]

export function isBusySlot({
  state,
  loading = false
}: Pick<SlotCard, 'state' | 'loading'>): boolean {
  return loading || state === 'pending'
}

/** 직접 조회는 사용자가 이름을 넣은 뒤라 캐릭터 검색 단계부터 보인다. */
export function getLookupStep({
  state,
  loading = false,
  scorePending = false
}: Pick<SlotCard, 'state' | 'loading' | 'scorePending'>): LookupStep | null {
  if (loading) {
    return '이름 인식'
  }

  if (state === 'pending') {
    return '캐릭터 검색'
  }

  if (state === 'success' && scorePending) {
    return '상세 정보 확인'
  }

  return null
}

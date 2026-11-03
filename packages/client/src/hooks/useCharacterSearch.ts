import { useCallback, useState } from 'react'
import { fillSlots } from '@dfragon/client-core/lib/slots'
import {
  nextCandidatePick,
  toCandidatePicker,
  type CandidatePick,
  type CandidatePicker
} from '@dfragon/client-core/lib/candidate-picker'
import type { SearchSlotCount } from '@dfragon/client-core/preload/common/types/search'
import type { CardSearchHost } from './useClientHost'
import { useManualCharacterLookup, type ManualCharacterLookup } from './useManualCharacterLookup'

export type CharacterSearch = ManualCharacterLookup & {
  candidatePickers: readonly (CandidatePicker | null)[]
  pickCandidate: (slot: number, serverId: string) => void
}

/**
 * 파티와 공대가 같은 후보 창을 쓰도록 직접 조회에 누른 후보를 더한다. 누른 후보는 그 슬롯이 직접 조회 상태인
 * 동안만 쓰므로, 다음 회차가 슬롯을 OCR 자동 검색으로 되돌리면 그 회차의 결과로 다시 판정한다.
 */
export function useCharacterSearch(
  host: CardSearchHost,
  slotCount: SearchSlotCount,
  onInvalidated?: () => void
): CharacterSearch {
  const search = useManualCharacterLookup(
    host,
    slotCount,
    host.notifyOcrCandidatesDetected,
    onInvalidated
  )
  const { lookupSlot: lookup, manualSlots } = search
  const [picks, setPicks] = useState<readonly (CandidatePick | null)[]>(() =>
    fillSlots(slotCount, null)
  )

  const setPick = useCallback((slot: number, pick: CandidatePick | null): void => {
    setPicks((current) => current.map((value, index) => (index === slot ? pick : value)))
  }, [])
  const lookupSlot = useCallback(
    (slot: number, nickname: string, serverId?: string): void => {
      setPick(slot, null)
      lookup(slot, nickname, serverId)
    },
    [lookup, setPick]
  )
  const candidatePickers = search.slots.map((slot, index) =>
    toCandidatePicker(slot, manualSlots[index] ? (picks[index] ?? null) : null)
  )
  const pickCandidate = (slot: number, serverId: string): void => {
    const next = nextCandidatePick(candidatePickers[slot] ?? null, serverId)
    const choice = next?.choices.find((candidate) => candidate.serverId === serverId)
    if (next === null || choice === undefined) {
      return
    }
    setPick(slot, next)
    lookup(slot, choice.characterName, serverId)
  }

  return { ...search, lookupSlot, candidatePickers, pickCandidate }
}

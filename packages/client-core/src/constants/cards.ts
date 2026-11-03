import { SEARCH_SLOT_COUNTS } from '../preload/common/types/search'
import type { SeatLayout } from '../lib/seats'
import type { CharacterTier } from '../types/cards'

export const tierLabels: Readonly<Record<CharacterTier, string>> = { top: '상위', ranker: '랭커' }

export const RAID_PARTY_COUNT = 3
export const RAID_PARTY_SIZE = 4
// 파티, 공대 모두 자리를 표의 행으로 위에서 아래로 놓으므로 위, 아래 방향으로만 맞바꾼다.
export const RAID_SEAT_LAYOUT: SeatLayout = { rows: RAID_PARTY_COUNT * RAID_PARTY_SIZE, columns: 1 }
export const PARTY_SEAT_LAYOUT: SeatLayout = { rows: SEARCH_SLOT_COUNTS.party, columns: 1 }

export const MISSING_VALUE = '-'

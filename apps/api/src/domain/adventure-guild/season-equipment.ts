import type { ItemDictionaryEntry } from '@dfragon/database'
import { z } from 'zod'

// 시즌마다 115레벨 같은 장비 레벨이다(2026-11-18 저장소 소유자 결정, ADR 0074). 이 표에 있는 시즌만 아이템 사전으로
// 장비를 가른다. 장비 레벨이 바뀐 시즌은 한 줄을 더한다.
const SEASON_EQUIPMENT_LEVELS: ReadonlyMap<number, number> = new Map([
  [10, 115],
  [11, 115]
])
// 칭호도 itemType이 액세서리지만 레벨이 0이나 1이라 장비 레벨로 빠진다(ADR 0074).
const EQUIPMENT_ITEM_TYPES: ReadonlySet<string | null> = new Set([
  '무기',
  '방어구',
  '액세서리',
  '추가장비'
])
const transcendenceData = z.object({ adventureSafeMoveType: z.enum(['in', 'out']) })

export type TranscendenceDirection = z.infer<typeof transcendenceData>['adventureSafeMoveType']

export function seasonEquipmentLevel(seasonId: number): number | undefined {
  return SEASON_EQUIPMENT_LEVELS.get(seasonId)
}

export function isSeasonEquipment(
  entry: ItemDictionaryEntry | undefined,
  equipmentLevel: number
): boolean {
  return entry?.availableLevel === equipmentLevel && EQUIPMENT_ITEM_TYPES.has(entry.itemType)
}

// 초월(516, 556) 기록의 data.adventureSafeMoveType은 받은 캐릭터가 in, 보낸 캐릭터가 out이다.
export function readTranscendenceDirection(data: unknown): TranscendenceDirection | undefined {
  return transcendenceData.safeParse(data).data?.adventureSafeMoveType
}

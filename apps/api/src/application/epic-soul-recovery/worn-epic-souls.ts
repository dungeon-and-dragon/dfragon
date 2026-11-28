import { type EpicSoulSlot, recoverEpicSouls } from '@dfragon/lib/epic-soul-recovery'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'

export interface WornEpicSoulSlot {
  readonly slotId: EpicSoulSlot
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
  readonly tune: number
  readonly souls: number
}

export interface WornEpicSouls {
  readonly total: number
  readonly slots: readonly WornEpicSoulSlot[]
}

function equippedItems(equipment: CharacterPayload): CharacterPayload[] {
  if (!Array.isArray(equipment.equipment)) {
    return []
  }

  return equipment.equipment.filter(isRecord)
}

function tuneLevelOf(item: CharacterPayload): number {
  const [first] = Array.isArray(item.tune) ? item.tune : []

  if (isRecord(first) && typeof first.level === 'number') {
    return first.level
  }

  return 0
}

function stringOf(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
}

/** 착용 장비 섹션 원문에서 에픽 부위마다 돌려받는 에픽 소울을 센다. */
export function wornEpicSouls(equipment: CharacterPayload): WornEpicSouls {
  const items = new Map<string, CharacterPayload>()
  const worn = equippedItems(equipment).flatMap((item) => {
    const { slotId, itemId } = item

    if (typeof slotId !== 'string' || typeof itemId !== 'string') {
      return []
    }

    items.set(slotId, item)

    return [{ slotId, itemId, tune: tuneLevelOf(item) }]
  })
  const recovery = recoverEpicSouls(worn)
  const slots = recovery.slots.map(({ slotId, itemId, tune, souls }) => {
    const item = items.get(slotId)

    return {
      slotId,
      itemId,
      itemName: stringOf(item?.itemName),
      itemRarity: stringOf(item?.itemRarity),
      tune,
      souls
    }
  })

  return { total: recovery.total, slots }
}

import {
  EQUIPMENT_VARIANT_SLOTS,
  type EquipmentVariantSlot,
  findEquipmentVariant,
  findWeaponVariant
} from './equipment-variants.js'

export const EPIC_SOUL_WEAPON_SLOT = 'WEAPON'

export type EpicSoulSlot = EquipmentVariantSlot | typeof EPIC_SOUL_WEAPON_SLOT

export interface WornEpicSoulItem {
  readonly slotId: string
  readonly itemId: string
  readonly tune: number
}

export interface EpicSoulSlotRecovery {
  readonly slotId: EpicSoulSlot
  readonly itemId: string
  readonly tune: number
  readonly souls: number
}

export interface EpicSoulRecovery {
  readonly total: number
  readonly slots: readonly EpicSoulSlotRecovery[]
}

const EPIC_RARITY = '에픽'
// 에픽을 레전더리로 낮출 때 부위마다 돌려받는 수는 저장소 소유자 설명이고, 조율 반환은 공식 가이드 "[장비] 조율 / 승급"의 반환표다.
const DOWNGRADE_SOULS = 1
const TUNE_SOULS = 10
const WEAPON_TUNE_SOULS = 15

function isVariantSlot(slotId: string): slotId is EquipmentVariantSlot {
  const slots: readonly string[] = EQUIPMENT_VARIANT_SLOTS

  return slots.includes(slotId)
}

function epicSlotOf(slotId: string, itemId: string): EpicSoulSlot | null {
  if (slotId === EPIC_SOUL_WEAPON_SLOT) {
    const rarity = findWeaponVariant(itemId)?.variant.rarity

    if (rarity !== EPIC_RARITY) {
      return null
    }

    return EPIC_SOUL_WEAPON_SLOT
  }

  if (!isVariantSlot(slotId)) {
    return null
  }

  const rarity = findEquipmentVariant(itemId)?.variant.rarity

  if (rarity !== EPIC_RARITY) {
    return null
  }

  return slotId
}

function soulsOf(slotId: EpicSoulSlot, tune: number): number {
  const perTune = slotId === EPIC_SOUL_WEAPON_SLOT ? WEAPON_TUNE_SOULS : TUNE_SOULS

  return DOWNGRADE_SOULS + tune * perTune
}

/** 선택지 목록에 있는 에픽 장비(잠식, 축성 포함)만 센다. 태초, 유일 장비, 목록 밖의 고유 장비, 레전더리 이하는 빠진다. */
export function recoverEpicSouls(worn: readonly WornEpicSoulItem[]): EpicSoulRecovery {
  const slots = worn.flatMap(({ slotId, itemId, tune }): EpicSoulSlotRecovery[] => {
    const epicSlot = epicSlotOf(slotId, itemId)

    if (epicSlot === null) {
      return []
    }

    const souls = soulsOf(epicSlot, tune)

    return [{ slotId: epicSlot, itemId, tune, souls }]
  })
  const total = slots.reduce((sum, { souls }) => sum + souls, 0)

  return { total, slots }
}

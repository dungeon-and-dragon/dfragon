import { weaponMaxTuneLevelOf } from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { EquipmentChange } from './equipment.js'
import { EquipmentSimulationFailure } from './failure.js'

const WEAPON_SLOT = 'WEAPON'

export interface WeaponTuneEdit {
  readonly original: CharacterPayload
  readonly level: number
}

function wornWeapon(equipment: CharacterPayload): CharacterPayload | null {
  const items = Array.isArray(equipment.equipment) ? equipment.equipment.filter(isRecord) : []
  const weapon = items.find((item) => item.slotId === WEAPON_SLOT)

  if (weapon === undefined) {
    return null
  }

  return weapon
}

function wornTuneLevel(weapon: CharacterPayload): number | null {
  const [first] = Array.isArray(weapon.tune) ? weapon.tune : []

  if (isRecord(first) && typeof first.level === 'number') {
    return first.level
  }

  return null
}

/** 무기는 조율만 바꾼다. 선택지와 정밀도, 조율할 수 없는 무기의 조율, 최대 단계를 넘는 조율은 거절한다. */
export function editWeaponTune(
  equipment: CharacterPayload,
  changes: readonly EquipmentChange[]
): WeaponTuneEdit | null {
  const change = changes.find(({ slotId }) => slotId === WEAPON_SLOT)

  if (change === undefined) {
    return null
  }

  if (change.variantId !== null || change.potency !== null) {
    throw new EquipmentSimulationFailure('request')
  }

  if (change.tune === null) {
    return null
  }

  const original = wornWeapon(equipment)
  const itemName = original?.itemName

  if (original === null || typeof itemName !== 'string') {
    throw new EquipmentSimulationFailure('request')
  }

  const maxLevel = weaponMaxTuneLevelOf(itemName)

  if (maxLevel === 0 || change.tune > maxLevel) {
    throw new EquipmentSimulationFailure('request')
  }

  if (change.tune === wornTuneLevel(original)) {
    return null
  }

  return { original, level: change.tune }
}

/** 엔진은 무기 `tune[0].level`만 읽으므로 그 칸만 바꾸고 표시값(`status`)은 그대로 둔다. */
export function withWeaponTune(
  entries: readonly CharacterPayload[],
  edit: WeaponTuneEdit | null
): CharacterPayload[] {
  if (edit === null) {
    return [...entries]
  }

  const index = entries.findIndex(({ slotId }) => slotId === WEAPON_SLOT)
  const weapon = structuredClone(index === -1 ? edit.original : entries[index]!)
  const [first, ...rest] = Array.isArray(weapon.tune) ? weapon.tune : []
  const tune = isRecord(first) ? first : {}
  weapon.tune = [{ ...tune, level: edit.level }, ...rest]

  if (index === -1) {
    return [...entries, weapon]
  }

  return entries.map((entry, position) => (position === index ? weapon : entry))
}

import {
  type EquipmentVariantItem,
  WEAPON_RELEASE_MAX,
  type WeaponVariant,
  findWeaponVariant,
  jobWeaponTypesOf,
  weaponItemOf,
  weaponMaxTuneLevelOf,
  weaponVariantsOf
} from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type {
  CharacterPayload,
  CharacterPayloads
} from '@dfragon/server-core/domain/character-detail/index.js'
import { ADDED_ITEM_GRADE, type EquipmentChange } from './equipment.js'
import { EquipmentSimulationFailure } from './failure.js'

const WEAPON_SLOT = 'WEAPON'
const RELEASE_LINE = '해방'
const DETAIL_KEYS = [
  'itemTypeId',
  'itemType',
  'itemTypeDetailId',
  'itemTypeDetail',
  'itemAvailableLevel'
] as const
// 엔진은 아이템을 바꿀 때 옛 무기의 옵션을 뺄 수만 있게 한다.
const OLD_OPTION_KEYS = ['asrahanOption', 'fixedOption'] as const

export interface WeaponEdit {
  /** null이면 무기를 끼지 않은 캐릭터에 무기를 더한다. */
  readonly original: CharacterPayload | null
  /** null이면 착용한 아이템을 그대로 둔다. */
  readonly item: EquipmentVariantItem | null
  readonly tune: number
  /** 해방 계열이 아니면 null이다. */
  readonly release: number | null
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

function wornRelease(weapon: CharacterPayload): number | null {
  const { weaponRelease } = weapon

  if (isRecord(weaponRelease) && typeof weaponRelease.value === 'number') {
    return weaponRelease.value
  }

  return null
}

function wornVariantOf(weapon: CharacterPayload): WeaponVariant | null {
  const { itemId } = weapon

  if (typeof itemId !== 'string') {
    return null
  }

  const match = findWeaponVariant(itemId)

  if (match === null) {
    return null
  }

  return match.variant
}

function chosenVariant(weapon: CharacterPayload, variantId: string): WeaponVariant {
  const { itemTypeDetail } = weapon
  const variants = typeof itemTypeDetail === 'string' ? weaponVariantsOf(itemTypeDetail) : []
  const variant = variants.find(({ id }) => id === variantId)

  if (variant === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  return variant
}

function addedVariant(payloads: CharacterPayloads, variantId: string): WeaponVariant {
  const { jobId, jobGrowId } = payloads.basic
  const types =
    typeof jobId === 'string' && typeof jobGrowId === 'string'
      ? jobWeaponTypesOf(jobId, jobGrowId)
      : []
  const variant = types.flatMap((type) => weaponVariantsOf(type)).find(({ id }) => id === variantId)

  if (variant === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  return variant
}

function addedTuneLevel(variant: WeaponVariant, change: EquipmentChange): number {
  if (change.tune === null) {
    return 0
  }

  if (change.tune > variant.maxTuneLevel) {
    throw new EquipmentSimulationFailure('request')
  }

  return change.tune
}

function addedRelease(variant: WeaponVariant, change: EquipmentChange): number | null {
  if (variant.line !== RELEASE_LINE) {
    if (change.release !== null) {
      throw new EquipmentSimulationFailure('request')
    }

    return null
  }

  if (change.release === null) {
    return WEAPON_RELEASE_MAX
  }

  return change.release
}

/** 직업이 낄 수 있는 무기 종류의 선택지로 더한 무기다. 선택지 없이 조율이나 해방 수치만 바꾸는 요청은 거절한다. */
function addedWeapon(payloads: CharacterPayloads, change: EquipmentChange): WeaponEdit {
  if (change.variantId === null) {
    throw new EquipmentSimulationFailure('request')
  }

  const variant = addedVariant(payloads, change.variantId)
  const tune = addedTuneLevel(variant, change)
  const release = addedRelease(variant, change)
  const item = weaponItemOf(variant, release ?? WEAPON_RELEASE_MAX)

  return { original: null, item, tune, release }
}

function tuneLevelOf(
  weapon: CharacterPayload,
  maxLevel: number,
  change: EquipmentChange,
  variantChanged: boolean
): number {
  const level = wornTuneLevel(weapon) ?? 0

  if (change.tune !== null) {
    if (maxLevel === 0 || change.tune > maxLevel) {
      throw new EquipmentSimulationFailure('request')
    }

    return change.tune
  }

  if (variantChanged) {
    return Math.min(level, maxLevel)
  }

  return level
}

function releaseOf(
  weapon: CharacterPayload,
  target: WeaponVariant | null,
  change: EquipmentChange,
  variantChanged: boolean
): number | null {
  const isRelease = target?.line === RELEASE_LINE

  if (change.release !== null) {
    if (!isRelease) {
      throw new EquipmentSimulationFailure('request')
    }

    return change.release
  }

  if (!isRelease) {
    return null
  }

  const worn = wornRelease(weapon)

  if (variantChanged || worn === null) {
    return WEAPON_RELEASE_MAX
  }

  return worn
}

/**
 * 무기는 착용한 무기 종류의 선택지로 아이템을 바꾸고 조율과 해방 수치를 바꾼다. 무기를 끼지 않은 캐릭터는 직업이 낄 수 있는 무기
 * 종류의 선택지로 무기를 더한다. 선택지 밖 id, 정밀도, 조율할 수 없는 무기의 조율, 최대 단계를 넘는 조율, 해방 계열이 아닌
 * 무기의 해방 수치는 거절한다.
 */
export function editWeapon(
  payloads: CharacterPayloads,
  changes: readonly EquipmentChange[]
): WeaponEdit | null {
  if (changes.some(({ slotId, release }) => slotId !== WEAPON_SLOT && release !== null)) {
    throw new EquipmentSimulationFailure('request')
  }

  const change = changes.find(({ slotId }) => slotId === WEAPON_SLOT)

  if (change === undefined) {
    return null
  }

  if (change.potency !== null) {
    throw new EquipmentSimulationFailure('request')
  }

  if (change.variantId === null && change.tune === null && change.release === null) {
    return null
  }

  const original = wornWeapon(payloads.equipment)

  if (original === null) {
    return addedWeapon(payloads, change)
  }

  const itemName = original.itemName

  if (typeof itemName !== 'string') {
    throw new EquipmentSimulationFailure('request')
  }

  const worn = wornVariantOf(original)
  const target = change.variantId !== null ? chosenVariant(original, change.variantId) : worn
  const variantChanged = target !== null && target.id !== worn?.id
  const maxLevel = target !== null ? target.maxTuneLevel : weaponMaxTuneLevelOf(itemName)
  const tune = tuneLevelOf(original, maxLevel, change, variantChanged)
  const release = releaseOf(original, target, change, variantChanged)
  const targetItem = target !== null ? weaponItemOf(target, release ?? WEAPON_RELEASE_MAX) : null
  const item = targetItem !== null && targetItem.itemId !== original.itemId ? targetItem : null
  const tuneChanged = tune !== wornTuneLevel(original)
  const releaseChanged = release !== null && release !== wornRelease(original)

  if (item === null && !tuneChanged && !releaseChanged) {
    return null
  }

  return { original, item, tune, release }
}

/** 엔진이 새 무기의 상세를 최상위 `items`에서 읽으므로 함께 조회할 아이템이다. */
export function weaponItemIds(edit: WeaponEdit | null): string[] {
  if (edit?.item == null) {
    return []
  }

  return [edit.item.itemId]
}

function replaceItem(
  weapon: CharacterPayload,
  item: EquipmentVariantItem,
  detail: CharacterPayload
): void {
  weapon.itemId = item.itemId
  weapon.itemName = item.itemName
  weapon.itemRarity = item.itemRarity

  for (const key of DETAIL_KEYS) {
    weapon[key] = detail[key] ?? null
  }

  for (const key of OLD_OPTION_KEYS) {
    delete weapon[key]
  }
}

// 엔진은 원본에 없는 무기를 강화, 재련, 마법부여 없이 아이템, 품질 등급, 조율, 해방 수치로만 더한다.
function addedWeaponEntry(item: EquipmentVariantItem, detail: CharacterPayload): CharacterPayload {
  const weapon: CharacterPayload = { slotId: WEAPON_SLOT }
  replaceItem(weapon, item, detail)
  weapon.itemGradeName = ADDED_ITEM_GRADE

  return weapon
}

function editedTune(weapon: CharacterPayload, edit: WeaponEdit): unknown[] {
  const [first, ...rest] = Array.isArray(weapon.tune) ? weapon.tune : []

  // 엔진은 `tune[0].level`만 읽으므로 아이템을 그대로 두면 표시값(`status`)도 그대로 둔다.
  if (edit.item === null && isRecord(first)) {
    return [{ ...first, level: edit.tune }, ...rest]
  }

  return [{ level: edit.tune }]
}

function itemDetailOf(
  item: EquipmentVariantItem,
  details: ReadonlyMap<string, CharacterPayload>
): CharacterPayload {
  const detail = details.get(item.itemId)

  if (detail === undefined) {
    throw new Error('A replaced weapon needs its item detail')
  }

  return detail
}

function weaponEntryOf(
  entry: CharacterPayload | undefined,
  edit: WeaponEdit,
  details: ReadonlyMap<string, CharacterPayload>
): CharacterPayload {
  if (edit.original === null) {
    if (edit.item === null) {
      throw new Error('An added weapon needs its item')
    }

    return addedWeaponEntry(edit.item, itemDetailOf(edit.item, details))
  }

  const weapon = structuredClone(entry ?? edit.original)

  if (edit.item !== null) {
    replaceItem(weapon, edit.item, itemDetailOf(edit.item, details))
  }

  return weapon
}

/**
 * `entries`의 무기 항목에, 없으면 원본 무기 항목에 아이템, 조율, 해방 수치를 바꿔 넣는다. 무기를 더하면 새 무기 항목을 만든다. 강화, 증폭, 재련, 마법부여와
 * 착용 품질(`itemGradeName`)은 그 항목의 값을 그대로 둔다.
 */
export function withWeapon(
  entries: readonly CharacterPayload[],
  edit: WeaponEdit | null,
  details: ReadonlyMap<string, CharacterPayload>
): CharacterPayload[] {
  if (edit === null) {
    return [...entries]
  }

  const index = entries.findIndex(({ slotId }) => slotId === WEAPON_SLOT)
  const weapon = weaponEntryOf(entries[index], edit, details)

  weapon.tune = editedTune(weapon, edit)

  // 엔진은 해방 수치만 읽고 데미지와 버프력은 다시 만든다.
  if (edit.release !== null) {
    weapon.weaponRelease = { value: edit.release }
  } else if (edit.item !== null) {
    delete weapon.weaponRelease
  }

  if (index === -1) {
    return [...entries, weapon]
  }

  return entries.map((entry, position) => (position === index ? weapon : entry))
}

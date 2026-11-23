import {
  EQUIPMENT_VARIANT_SLOTS,
  type EquipmentVariant,
  type EquipmentVariantItem,
  type EquipmentVariantItems,
  type EquipmentVariantKind,
  type EquipmentVariantSlot,
  equipmentSets,
  equipmentVariantsOf,
  findEquipmentVariant,
  resolveEquipmentItems,
  switchEquipmentSet
} from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { EquipmentChange } from './equipment.js'
import { EquipmentSimulationFailure } from './failure.js'

const EXALTED_POTENCY_DEFAULT = 100
const DETAIL_KEYS = [
  'itemTypeId',
  'itemType',
  'itemTypeDetailId',
  'itemTypeDetail',
  'setItemId',
  'setItemName'
] as const
const EXALTED_KEYS = ['exaltedInfo', 'potency', 'customOption'] as const

interface TuneEdit {
  readonly level: number
  readonly setPoint: number
}

export interface EquipmentItemEdit {
  readonly slotId: EquipmentVariantSlot
  readonly original: CharacterPayload
  /** null이면 착용한 아이템을 그대로 둔다. */
  readonly item: EquipmentVariantItem | null
  readonly kind: EquipmentVariantKind
  /** null이면 착용한 조율을 그대로 둔다. */
  readonly tune: TuneEdit | null
  /** null이면 착용한 정밀도를 그대로 둔다. */
  readonly potency: number | null
}

interface WornSlot {
  readonly slotId: EquipmentVariantSlot
  readonly original: CharacterPayload
  /** 선택 목록에 없는 아이템(레어, 고유 장비 등)이면 null이다. */
  readonly variant: EquipmentVariant | null
}

function isVariantSlot(slotId: string): slotId is EquipmentVariantSlot {
  const slots: readonly string[] = EQUIPMENT_VARIANT_SLOTS

  return slots.includes(slotId)
}

function hasItemChange(change: EquipmentChange): boolean {
  return change.variantId !== null || change.tune !== null || change.potency !== null
}

function wornSlots(equipment: CharacterPayload): Map<EquipmentVariantSlot, WornSlot> {
  const items = Array.isArray(equipment.equipment) ? equipment.equipment.filter(isRecord) : []
  const slots = new Map<EquipmentVariantSlot, WornSlot>()

  for (const original of items) {
    const { slotId, itemId } = original

    if (typeof slotId === 'string' && isVariantSlot(slotId)) {
      const variant =
        typeof itemId === 'string' ? (findEquipmentVariant(itemId)?.variant ?? null) : null
      slots.set(slotId, { slotId, original, variant })
    }
  }

  return slots
}

function setPointOf(info: Record<string, unknown>): number | null {
  const active = info.active

  if (!isRecord(active) || !isRecord(active.setPoint)) {
    return null
  }

  const { current } = active.setPoint

  if (typeof current !== 'number') {
    return null
  }

  return current
}

function isListedSet(setItemId: unknown, slotId: EquipmentVariantSlot): setItemId is string {
  return typeof setItemId === 'string' && equipmentVariantsOf(setItemId, slotId).length > 0
}

/** 선택 목록에 있는 세트 가운데 활성 세트 포인트가 가장 큰 세트이고, 동률이면 응답에서 먼저 나온 세트다. */
function mainSetItemId(equipment: CharacterPayload, slotId: EquipmentVariantSlot): string | null {
  const infos = Array.isArray(equipment.setItemInfo) ? equipment.setItemInfo.filter(isRecord) : []
  let chosen: string | null = null
  let chosenPoint = Number.NEGATIVE_INFINITY

  for (const info of infos) {
    const point = setPointOf(info)

    if (point !== null && point > chosenPoint && isListedSet(info.setItemId, slotId)) {
      chosen = info.setItemId
      chosenPoint = point
    }
  }

  return chosen
}

function choiceSetOf(
  equipment: CharacterPayload,
  worn: WornSlot,
  equipmentSet: string | null
): string | null {
  if (equipmentSet !== null) {
    return equipmentSet
  }

  // 세트 밖 장비와 선택 목록에 없는 세트의 장비는 주 세트의 그 부위로 바꾼다.
  const { setItemId } = worn.original

  if (isListedSet(setItemId, worn.slotId)) {
    return setItemId
  }

  return mainSetItemId(equipment, worn.slotId)
}

function chosenVariant(
  equipment: CharacterPayload,
  worn: WornSlot,
  variantId: string,
  equipmentSet: string | null
): EquipmentVariant {
  const setId = choiceSetOf(equipment, worn, equipmentSet)

  if (setId === null) {
    throw new EquipmentSimulationFailure('request')
  }

  const variant = equipmentVariantsOf(setId, worn.slotId).find(({ id }) => id === variantId)

  if (variant === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  return variant
}

function wornTuneLevel(original: CharacterPayload): number {
  const [first] = Array.isArray(original.tune) ? original.tune : []

  if (isRecord(first) && typeof first.level === 'number') {
    return first.level
  }

  return 0
}

function wornPotency(original: CharacterPayload): number | null {
  const { potency } = original

  if (isRecord(potency) && typeof potency.value === 'number') {
    return potency.value
  }

  return null
}

function tuneLevelOf(
  worn: WornSlot,
  target: EquipmentVariant | null,
  change: EquipmentChange | undefined,
  itemChanged: boolean
): number {
  const level = wornTuneLevel(worn.original)

  if (change?.tune != null) {
    if (target === null || change.tune >= target.tuneSetPoints.length) {
      throw new EquipmentSimulationFailure('request')
    }

    return change.tune
  }

  if (itemChanged && target !== null) {
    return Math.min(level, target.tuneSetPoints.length - 1)
  }

  return level
}

function potencyOf(
  target: EquipmentVariant | null,
  change: EquipmentChange | undefined,
  itemChanged: boolean
): number | null {
  const isExalted = target?.kind === '유일'

  if (change?.potency != null) {
    if (!isExalted) {
      throw new EquipmentSimulationFailure('request')
    }

    return change.potency
  }

  if (itemChanged && isExalted) {
    return EXALTED_POTENCY_DEFAULT
  }

  return null
}

// 같은 이름에 itemId가 여럿인 선택지가 있어, itemId 대신 선택지와 이름이 같은지로 본다.
function isWornItem(worn: WornSlot, target: EquipmentVariant, item: EquipmentVariantItem): boolean {
  return worn.variant?.id === target.id && worn.original.itemName === item.itemName
}

type Targets = ReadonlyMap<EquipmentVariantSlot, EquipmentVariant | null>

function checkedEquipmentSet(equipmentSet: string | null): string | null {
  if (equipmentSet === null) {
    return null
  }

  if (!equipmentSets().some(({ setItemId }) => setItemId === equipmentSet)) {
    throw new EquipmentSimulationFailure('request')
  }

  return equipmentSet
}

/** 세트를 고르면 유일 장비와 선택지 밖 착용 아이템을 뺀 부위를 그 세트의 같은 등급으로 옮긴다. */
function switchedTargets(
  worn: ReadonlyMap<EquipmentVariantSlot, WornSlot>,
  equipmentSet: string | null
): Map<EquipmentVariantSlot, EquipmentVariant | null> {
  const wornTargets = new Map([...worn].map(([slotId, { variant }]) => [slotId, variant]))

  if (equipmentSet === null) {
    return wornTargets
  }

  const switched = switchEquipmentSet(Object.fromEntries(wornTargets), equipmentSet)

  return new Map([...wornTargets].map(([slotId, variant]) => [slotId, switched[slotId] ?? variant]))
}

function itemChanges(
  worn: ReadonlyMap<EquipmentVariantSlot, WornSlot>,
  changes: readonly EquipmentChange[]
): Map<EquipmentVariantSlot, EquipmentChange> {
  const checked = new Map<EquipmentVariantSlot, EquipmentChange>()

  for (const change of changes) {
    // 무기는 weapon.ts가 맡는다.
    if (!hasItemChange(change) || !isVariantSlot(change.slotId)) {
      continue
    }

    if (!worn.has(change.slotId)) {
      throw new EquipmentSimulationFailure('request')
    }

    checked.set(change.slotId, change)
  }

  return checked
}

function resolvedItems(targets: Targets): EquipmentVariantItems {
  const selection = Object.fromEntries(
    [...targets].flatMap(([slotId, target]) => {
      if (target === null) {
        return []
      }

      return [[slotId, target]]
    })
  )

  return resolveEquipmentItems(selection)
}

/**
 * 무기를 뺀 11부위의 세트 전환, 아이템, 조율, 정밀도 변경과 5축성 변환으로 바뀌는 부위다.
 * 목록에 없는 세트, 착용하지 않은 부위, 그 세트의 선택지에 없는 id, 조율 단계 밖의 조율, 유일 장비가 아닌 아이템의 정밀도는 거절한다.
 */
export function editEquipmentItems(
  equipment: CharacterPayload,
  changes: readonly EquipmentChange[],
  requestedSet: string | null
): EquipmentItemEdit[] {
  const equipmentSet = checkedEquipmentSet(requestedSet)
  const worn = wornSlots(equipment)
  const checked = itemChanges(worn, changes)
  const targets = switchedTargets(worn, equipmentSet)

  for (const [slotId, change] of checked) {
    if (change.variantId !== null) {
      const chosen = chosenVariant(equipment, worn.get(slotId)!, change.variantId, equipmentSet)
      targets.set(slotId, chosen)
    }
  }

  // 아이템을 바꾸지 않은 요청은 착용 상태를 다시 풀지 않아, 기존 요청의 엔진 입력이 그대로다.
  const changesItems =
    equipmentSet !== null || [...checked.values()].some(({ variantId }) => variantId !== null)
  const items = changesItems ? resolvedItems(targets) : {}

  return [...worn.values()].flatMap((slot): EquipmentItemEdit[] => {
    const change = checked.get(slot.slotId)
    const target = targets.get(slot.slotId) ?? null
    const resolved = items[slot.slotId]
    const itemChanged =
      resolved !== undefined && target !== null && !isWornItem(slot, target, resolved)
    const level = tuneLevelOf(slot, target, change, itemChanged)
    const potency = potencyOf(target, change, itemChanged)
    const tuneChanged = level !== wornTuneLevel(slot.original)
    const potencyChanged = potency !== null && potency !== wornPotency(slot.original)

    if (target === null || (!itemChanged && !tuneChanged && !potencyChanged)) {
      return []
    }

    const item = itemChanged ? resolved : null
    const tune =
      itemChanged || tuneChanged ? { level, setPoint: target.tuneSetPoints[level]! } : null
    const editedPotency = itemChanged || potencyChanged ? potency : null

    return [
      {
        slotId: slot.slotId,
        original: slot.original,
        item,
        kind: target.kind,
        tune,
        potency: editedPotency
      }
    ]
  })
}

/** 엔진이 새 아이템의 상세를 최상위 `items`에서 읽으므로 함께 조회할 아이템이다. */
export function equipmentItemIds(edits: readonly EquipmentItemEdit[]): string[] {
  return edits.flatMap(({ item }) => {
    if (item === null) {
      return []
    }

    return [item.itemId]
  })
}

function firstTune(entry: CharacterPayload): Record<string, unknown> {
  const [first] = Array.isArray(entry.tune) ? entry.tune : []

  if (!isRecord(first)) {
    return {}
  }

  return first
}

function replaceItem(
  entry: CharacterPayload,
  item: EquipmentVariantItem,
  kind: EquipmentVariantKind,
  detail: CharacterPayload
): void {
  entry.itemId = item.itemId
  entry.itemName = item.itemName
  entry.itemRarity = item.itemRarity

  for (const key of DETAIL_KEYS) {
    entry[key] = detail[key] ?? null
  }

  delete entry.consecrate
  delete entry.scourge

  if (kind === '축성') {
    entry.consecrate = true
  }

  if (kind === '잠식') {
    entry.scourge = true
  }

  // 유일 장비의 옵션 수치는 엔진이 표로 만들고, 다른 유일 장비의 커스텀 옵션은 새 아이템에 맞지 않는다.
  for (const key of EXALTED_KEYS) {
    delete entry[key]
  }
}

function replacedEntry(
  entry: CharacterPayload,
  edit: EquipmentItemEdit,
  details: ReadonlyMap<string, CharacterPayload>
): CharacterPayload {
  const replaced = structuredClone(entry)

  if (edit.item !== null) {
    const detail = details.get(edit.item.itemId)

    if (detail === undefined) {
      throw new Error('A replaced equipment item needs its item detail')
    }

    replaceItem(replaced, edit.item, edit.kind, detail)
  }

  if (edit.tune !== null) {
    const kept = edit.item === null ? firstTune(replaced) : {}
    replaced.tune = [{ ...kept, level: edit.tune.level, setPoint: edit.tune.setPoint }]
  }

  // 엔진은 정밀도 수치만 읽고 데미지와 버프력은 다시 만든다.
  if (edit.potency !== null) {
    replaced.potency = { value: edit.potency }
  }

  return replaced
}

/**
 * `entries`에서 `slotId`가 같은 항목에, 없으면 원본 항목에 아이템, 조율, 정밀도를 바꿔 넣는다.
 * 강화, 증폭, 마법부여와 착용 품질(`itemGradeName`)은 그 항목의 값을 그대로 둔다.
 */
export function withEquipmentItems(
  entries: readonly CharacterPayload[],
  edits: readonly EquipmentItemEdit[],
  details: ReadonlyMap<string, CharacterPayload>
): CharacterPayload[] {
  const result = [...entries]

  for (const edit of edits) {
    const index = result.findIndex((entry) => entry.slotId === edit.slotId)

    if (index === -1) {
      result.push(replacedEntry(edit.original, edit, details))
    } else {
      result[index] = replacedEntry(result[index]!, edit, details)
    }
  }

  return result
}

import {
  EPIC_SOUL_WEAPON_SLOT,
  type EpicSoulRecovery,
  type EpicSoulSlot,
  recoverEpicSouls
} from '@dfragon/lib/epic-soul-recovery'
import {
  type EquipmentVariantItem,
  type WeaponVariantLine,
  equipmentSets,
  equipmentVariantsOf,
  weaponVariantsOf
} from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { EquipmentSimulationRequest } from '#application/equipment-simulation/index.js'
import type { EquipmentChange } from '#domain/equipment-simulation/index.js'

const LEGENDARY = '레전더리'
const PRIMEVAL = '태초'
const NORMAL_KIND = '일반'
const ACCESSORY_SLOTS: readonly string[] = ['AMULET', 'WRIST', 'RING']
const WEAPON_LINES: readonly WeaponVariantLine[] = ['기본', '태초의 별']

export interface WornEpicItem {
  readonly slotId: EpicSoulSlot
  readonly itemId: string
  readonly itemName: string
  readonly itemRarity: string
  readonly tune: number
  readonly reinforce: number
  readonly amplified: boolean
  readonly souls: number
}

export interface WornEpicItems {
  readonly total: number
  readonly slots: readonly WornEpicItem[]
}

export interface RecoveryAfterItem extends EquipmentVariantItem {
  /** 무기에만 있다. */
  readonly line?: WeaponVariantLine
}

export interface RecoveryCandidate {
  readonly setItemId: string
  /** 무기가 에픽이 아니면 null이다. */
  readonly weaponVariantId: string | null
  readonly after: ReadonlyMap<EpicSoulSlot, RecoveryAfterItem>
  readonly request: EquipmentSimulationRequest
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

function wornOf(equipment: CharacterPayload, slotId: string): CharacterPayload {
  const item = equippedItems(equipment).find((candidate) => candidate.slotId === slotId)

  if (item === undefined) {
    throw new Error(`An epic slot needs its worn item: ${slotId}`)
  }

  return item
}

function reinforceOf(item: CharacterPayload): number {
  if (typeof item.reinforce !== 'number') {
    return 0
  }

  return item.reinforce
}

function isAmplified(item: CharacterPayload): boolean {
  return typeof item.amplificationName === 'string'
}

export function wornEpicItems(equipment: CharacterPayload): WornEpicItems {
  const worn = equippedItems(equipment).flatMap((item) => {
    const { slotId, itemId } = item

    if (typeof slotId !== 'string' || typeof itemId !== 'string') {
      return []
    }

    return [{ slotId, itemId, tune: tuneLevelOf(item) }]
  })
  const recovery: EpicSoulRecovery = recoverEpicSouls(worn)
  const slots = recovery.slots.map(({ slotId, itemId, tune, souls }) => {
    const item = wornOf(equipment, slotId)
    const itemName = stringOf(item.itemName)
    const itemRarity = stringOf(item.itemRarity)
    const reinforce = reinforceOf(item)
    const amplified = isAmplified(item)

    return { slotId, itemId, itemName, itemRarity, tune, reinforce, amplified, souls }
  })

  return { total: recovery.total, slots }
}

function targetRarityOf(slotId: string, includePrimordial: boolean): string {
  if (includePrimordial && ACCESSORY_SLOTS.includes(slotId)) {
    return PRIMEVAL
  }

  return LEGENDARY
}

function keptChange(
  slotId: EpicSoulSlot,
  item: CharacterPayload,
  variantId: string,
  tune: number | null
): EquipmentChange {
  const reinforce = reinforceOf(item)
  const amplified = isAmplified(item)

  return {
    slotId,
    reinforce,
    amplified,
    enchantId: null,
    variantId,
    tune,
    potency: null,
    release: null
  }
}

function requestOf(setItemId: string, equipment: EquipmentChange[]): EquipmentSimulationRequest {
  return {
    equipmentSet: setItemId,
    equipment,
    slotItems: { title: null, creature: null, aura: null },
    oath: { set: null, body: null, crystals: [], upgrade: null },
    buffLevel: null,
    switchingEquipment: null,
    avatarPreset: null
  }
}

interface SlotTarget {
  readonly change: EquipmentChange
  readonly after: RecoveryAfterItem
}

function slotTargetsOf(
  equipment: CharacterPayload,
  slots: readonly WornEpicItem[],
  setItemId: string,
  includePrimordial: boolean
): Map<EpicSoulSlot, SlotTarget> | null {
  const targets = new Map<EpicSoulSlot, SlotTarget>()

  for (const { slotId } of slots) {
    if (slotId === EPIC_SOUL_WEAPON_SLOT) {
      continue
    }

    const rarity = targetRarityOf(slotId, includePrimordial)
    const variant = equipmentVariantsOf(setItemId, slotId).find(
      (candidate) => candidate.rarity === rarity && candidate.kind === NORMAL_KIND
    )

    if (variant === undefined) {
      return null
    }

    const worn = wornOf(equipment, slotId)
    const change = keptChange(slotId, worn, variant.id, 0)
    targets.set(slotId, { change, after: variant.item })
  }

  return targets
}

interface WeaponTarget {
  readonly variantId: string
  readonly target: SlotTarget
}

function weaponTargetsOf(
  equipment: CharacterPayload,
  slots: readonly WornEpicItem[]
): (WeaponTarget | null)[] {
  if (!slots.some(({ slotId }) => slotId === EPIC_SOUL_WEAPON_SLOT)) {
    return [null]
  }

  const weapon = wornOf(equipment, EPIC_SOUL_WEAPON_SLOT)
  const variants = weaponVariantsOf(stringOf(weapon.itemTypeDetail))

  return WEAPON_LINES.flatMap((line) => {
    const variant = variants.find(
      (candidate) => candidate.rarity === LEGENDARY && candidate.line === line
    )

    if (variant === undefined) {
      return []
    }

    // 조율할 수 없는 무기에 조율 단계를 주면 시뮬레이션이 요청을 거절한다.
    const tune = variant.maxTuneLevel > 0 ? 0 : null
    const change = keptChange(EPIC_SOUL_WEAPON_SLOT, weapon, variant.id, tune)
    const target: SlotTarget = { change, after: { ...variant.item, line } }

    return [{ variantId: variant.id, target }]
  })
}

/**
 * 13세트마다, 무기가 에픽이면 레거시와 태초의 별 레전더리마다 하나씩 에픽 부위를 레전더리(악세서리는 고르면 태초), 조율 0으로 바꾼
 * 요청이다. 세트에 그 등급의 일반 장비가 없는 부위가 있으면 그 세트는 뺀다.
 */
export function recoveryCandidates(
  equipment: CharacterPayload,
  worn: WornEpicItems,
  includePrimordial: boolean
): RecoveryCandidate[] {
  if (worn.slots.length === 0) {
    return []
  }

  const weapons = weaponTargetsOf(equipment, worn.slots)

  return equipmentSets().flatMap(({ setItemId }) => {
    const targets = slotTargetsOf(equipment, worn.slots, setItemId, includePrimordial)

    if (targets === null) {
      return []
    }

    return weapons.map((weapon) => {
      const slotTargets = new Map(targets)

      if (weapon !== null) {
        slotTargets.set(EPIC_SOUL_WEAPON_SLOT, weapon.target)
      }

      const changes = [...slotTargets.values()].map(({ change }) => change)
      const after = new Map([...slotTargets].map(([slotId, { after }]) => [slotId, after]))
      const weaponVariantId = weapon?.variantId ?? null
      const request = requestOf(setItemId, changes)

      return { setItemId, weaponVariantId, after, request }
    })
  })
}

import {
  type OathCrystalVariant,
  type OathVariant,
  findOathCrystal,
  findOathCrystalVariant,
  findOathVariant,
  moveOathCrystalToSet,
  oathCrystalVariantsOf,
  oathSets,
  oathVariantOf,
  oathVariantsOf,
  PRIMEVAL_OATH_CRYSTAL_LIMIT
} from '@dfragon/lib/equipment-variants'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { ScoreSimulationInput } from '@dfragon/server-core/domain/score/index.js'
import { EquipmentSimulationFailure } from './failure.js'

export interface OathCrystalChange {
  readonly slotNo: number
  /** null이면 결정의 조율 단계를 그대로 둔다(아이템을 바꾸면 새 결정의 최대 단계로 자른다). */
  readonly tune: number | null
  /** 광휘 결정 선택지 id이고, null이면 결정을 그대로 둔다. */
  readonly variantId: string | null
}

export interface OathChanges {
  /** 서약 세트 번호이고, null이면 그대로 둔다. */
  readonly set: number | null
  /** 서약 본체 선택지 id이고, null이면 그대로 둔다. */
  readonly body: string | null
  readonly crystals: readonly OathCrystalChange[]
}

export interface OathEdit {
  /** 원본과 다른 서약 세트일 때만 있다. */
  readonly set: number | null
  readonly body: CharacterPayload | null
  readonly crystals: readonly CharacterPayload[]
  /** 서약 세트, 본체, 결정 아이템 가운데 하나라도 바꿨는지 */
  readonly changesItems: boolean
}

type SimulatedOath = NonNullable<ScoreSimulationInput['oath']>

const PRIMEVAL_RARITY = '태초'

const noOathEdit: OathEdit = { set: null, body: null, crystals: [], changesItems: false }

function hasChanges(changes: OathChanges): boolean {
  return changes.set !== null || changes.body !== null || changes.crystals.length > 0
}

function wornOath(oath: CharacterPayload): CharacterPayload {
  const section = oath.oath

  if (!isRecord(section) || !Array.isArray(section.crystal)) {
    throw new EquipmentSimulationFailure('request')
  }

  return section
}

function wornSetId(section: CharacterPayload): number | null {
  const { setInfo } = section

  if (!isRecord(setInfo) || typeof setInfo.setId !== 'number') {
    return null
  }

  return setInfo.setId
}

/** 본체와 결정을 옮길 서약 세트이고, 원본과 같은 세트여도 다른 세트의 본체와 광휘 결정을 그 세트로 옮긴다. */
function checkedSet(section: CharacterPayload, set: number | null): number | null {
  if (set === null) {
    return null
  }

  if (wornSetId(section) === null || !oathSets().some(({ setId }) => setId === set)) {
    throw new EquipmentSimulationFailure('request')
  }

  return set
}

function wornItemId(item: unknown): string | null {
  if (!isRecord(item) || typeof item.itemId !== 'string') {
    return null
  }

  return item.itemId
}

/** 세트 전용 본체만 새 세트의 같은 등급으로 옮기고, 영겁의 안개 서약과 목록 밖 본체는 그대로 둔다. */
function bodyTarget(
  info: unknown,
  set: number | null,
  body: string | null
): { worn: OathVariant | null; target: OathVariant | null } {
  const itemId = wornItemId(info)
  const match = itemId !== null ? findOathVariant(itemId) : null

  if (match === null) {
    if (body !== null) {
      throw new EquipmentSimulationFailure('request')
    }

    return { worn: null, target: null }
  }

  const family = match.setId !== null ? (set ?? match.setId) : null
  const moved = oathVariantOf(family, match.variant.rarity) ?? match.variant

  if (body === null) {
    return { worn: match.variant, target: moved }
  }

  const chosen = oathVariantsOf(family).find(({ id }) => id === body)

  if (chosen === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  return { worn: match.variant, target: chosen }
}

function replacedItem(
  original: CharacterPayload,
  variant: OathVariant | OathCrystalVariant
): CharacterPayload {
  const { itemId, itemName, itemRarity } = variant.item
  const cloned = structuredClone(original)

  return { ...cloned, itemId, itemName, itemRarity }
}

function simulatedBody(info: unknown, set: number | null, body: string | null) {
  const { worn, target } = bodyTarget(info, set, body)

  if (!isRecord(info) || worn === null || target === null || target.id === worn.id) {
    return null
  }

  const replaced = replacedItem(info, target)

  return { ...replaced, setPoint: target.setPoint }
}

function wornTuneLevel(crystal: CharacterPayload): number {
  const { tune } = crystal

  if (isRecord(tune) && typeof tune.level === 'number') {
    return tune.level
  }

  return 0
}

function crystalTarget(
  crystal: CharacterPayload,
  change: OathCrystalChange | undefined,
  set: number | null,
  setId: number | null
): OathCrystalVariant | null {
  if (change?.variantId != null) {
    if (setId === null) {
      throw new EquipmentSimulationFailure('request')
    }

    const chosen = oathCrystalVariantsOf(setId).find(({ id }) => id === change.variantId)

    if (chosen === undefined) {
      throw new EquipmentSimulationFailure('request')
    }

    return chosen
  }

  const itemId = wornItemId(crystal)

  if (set === null || itemId === null) {
    return null
  }

  return moveOathCrystalToSet(itemId, set)
}

/** 광휘가 아닌 결정도 이름으로 조율 포인트를 찾고, 모르는 결정은 거절한다. */
function wornTuneSetPoints(crystal: CharacterPayload): readonly number[] {
  const setPoints =
    typeof crystal.itemName === 'string' ? findOathCrystal(crystal.itemName)?.tuneSetPoints : null

  if (setPoints == null) {
    throw new EquipmentSimulationFailure('request')
  }

  return setPoints
}

function simulatedCrystal(
  crystal: CharacterPayload,
  change: OathCrystalChange | undefined,
  set: number | null,
  setId: number | null
): CharacterPayload | null {
  const target = crystalTarget(crystal, change, set, setId)
  const itemId = wornItemId(crystal)
  const wornVariant = itemId !== null ? findOathCrystalVariant(itemId)?.variant : null
  const itemChanged = target !== null && target.id !== wornVariant?.id

  if (!itemChanged && change?.tune == null) {
    return null
  }

  const setPoints = itemChanged ? target.tuneSetPoints : wornTuneSetPoints(crystal)

  const level =
    change?.tune != null ? change.tune : Math.min(wornTuneLevel(crystal), setPoints.length - 1)
  const setPoint = setPoints[level]

  if (setPoint === undefined) {
    throw new EquipmentSimulationFailure('request')
  }

  const replaced = itemChanged ? replacedItem(crystal, target) : structuredClone(crystal)
  const tune = isRecord(replaced.tune) ? replaced.tune : {}
  replaced.tune = { ...tune, level, setPoint }

  return replaced
}

/** 바꾼 결정을 적용한 최종 결정 가운데 태초 결정의 수다. */
function primevalCount(
  crystals: readonly CharacterPayload[],
  edited: readonly CharacterPayload[]
): number {
  return crystals.filter((crystal) => {
    const final = edited.find(({ slotNo }) => slotNo === crystal.slotNo) ?? crystal

    return final.itemRarity === PRIMEVAL_RARITY
  }).length
}

/**
 * 서약 세트를 옮긴 뒤 본체 등급과 결정의 등급, 조율을 바꾼다.
 * 서약이 없는 캐릭터, 목록에 없는 세트나 선택지, 원본에 없는 슬롯, 조율 단계 밖의 조율과 태초 결정이 3개를 넘는 결정 교체는 거절한다.
 */
export function editOath(oath: CharacterPayload, changes: OathChanges): OathEdit {
  if (!hasChanges(changes)) {
    return noOathEdit
  }

  const section = wornOath(oath)
  const crystals = (section.crystal as unknown[]).filter(isRecord)
  const worn = wornSetId(section)
  const set = checkedSet(section, changes.set)
  const setId = set ?? worn
  // 엔진에는 서약 세트가 실제로 바뀔 때만 세트를 넣는다.
  const changedSet = set !== worn ? set : null

  for (const { slotNo } of changes.crystals) {
    if (!crystals.some((crystal) => crystal.slotNo === slotNo)) {
      throw new EquipmentSimulationFailure('request')
    }
  }

  const body = simulatedBody(section.info, set, changes.body)
  const edited = crystals.flatMap((crystal) => {
    const change = changes.crystals.find(({ slotNo }) => slotNo === crystal.slotNo)
    const simulated = simulatedCrystal(crystal, change, set, setId)

    if (simulated === null) {
      return []
    }

    return [simulated]
  })
  const changesCrystals = edited.some((crystal) => {
    const original = crystals.find(({ slotNo }) => slotNo === crystal.slotNo)

    return original?.itemId !== crystal.itemId
  })

  // 원본이 규칙을 어겨도 결정 아이템을 바꾸지 않는 요청은 그대로 계산한다.
  if (changesCrystals && primevalCount(crystals, edited) > PRIMEVAL_OATH_CRYSTAL_LIMIT) {
    throw new EquipmentSimulationFailure('request')
  }

  const changesItems = changedSet !== null || body !== null || changesCrystals

  return { set: changedSet, body, crystals: edited, changesItems }
}

export function hasOathEdit(edit: OathEdit): boolean {
  return edit.set !== null || edit.body !== null || edit.crystals.length > 0
}

/** 바꾼 칸만 담고, 아무것도 바꾸지 않았으면 null이다. */
export function simulatedOath(edit: OathEdit): SimulatedOath | null {
  if (!hasOathEdit(edit)) {
    return null
  }

  const oath: { -readonly [K in keyof SimulatedOath]: SimulatedOath[K] } = {}

  if (edit.body !== null) {
    oath.info = edit.body
  }

  if (edit.set !== null) {
    oath.set = { setId: edit.set }
  }

  if (edit.crystals.length > 0) {
    oath.crystal = edit.crystals
  }

  return oath
}

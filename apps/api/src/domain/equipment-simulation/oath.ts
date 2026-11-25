import {
  type OathCrystalVariant,
  type OathUpgradeSelection,
  type OathVariant,
  findOathCrystal,
  findOathCrystalVariant,
  findOathVariant,
  inferOathSetId,
  isValidOathUpgrade,
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
  /** 바꾼 뒤의 묵언의 진의 전체이고, null이면 그대로 둔다. */
  readonly upgrade: readonly OathUpgradeSelection[] | null
}

export interface OathEdit {
  /** 원본과 다른 서약 세트일 때만 있다. */
  readonly set: number | null
  readonly body: CharacterPayload | null
  readonly crystals: readonly CharacterPayload[]
  /** 원본과 다른 진의일 때만 있다. */
  readonly upgrade: readonly OathUpgradeSelection[] | null
  /** 서약 세트, 본체, 결정 아이템 가운데 하나라도 바꿨는지 */
  readonly changesItems: boolean
  /** 원본 서약 응답에 세트가 없어 지금 세트를 본체와 결정으로 추론하는지 */
  readonly setInfoMissing: boolean
  /** 원본에 없는 본체나 결정 칸에 아이템을 더하는지 */
  readonly addsItems: boolean
}

type SimulatedOath = NonNullable<ScoreSimulationInput['oath']>

const PRIMEVAL_RARITY = '태초'
// 서약 결정 칸은 slotNo 0~10이다.
const CRYSTAL_SLOTS = 11

const noOathEdit: OathEdit = {
  set: null,
  body: null,
  crystals: [],
  upgrade: null,
  changesItems: false,
  setInfoMissing: false,
  addsItems: false
}

function hasChanges(changes: OathChanges): boolean {
  return (
    changes.set !== null ||
    changes.body !== null ||
    changes.crystals.length > 0 ||
    changes.upgrade !== null
  )
}

/** 엔진과 같이 응답 배열의 순서를 단계로 읽고, 진의가 없으면 빈 목록이다. */
function wornUpgrade(info: unknown): OathUpgradeSelection[] {
  const upgrade = isRecord(info) ? info.oathUpgrade : null
  const options = isRecord(upgrade) && Array.isArray(upgrade.options) ? upgrade.options : []

  return options.map((option, index) => {
    const optionName = isRecord(option) ? option.optionName : null
    const name = typeof optionName === 'string' ? optionName : ''
    const step = index + 1

    return { step, option: name }
  })
}

function isSameUpgrade(
  left: readonly OathUpgradeSelection[],
  right: readonly OathUpgradeSelection[]
): boolean {
  return (
    left.length === right.length &&
    left.every(({ step, option }, index) => {
      const other = right[index]!

      return step === other.step && option === other.option
    })
  )
}

/** 서약 본체가 없는 캐릭터와 1단계부터 이어지지 않거나 그 단계에 없는 선택지는 거절하고, 원본과 같으면 바꾸지 않는다. */
function changedUpgrade(
  info: unknown,
  upgrade: readonly OathUpgradeSelection[] | null
): OathUpgradeSelection[] | null {
  if (upgrade === null) {
    return null
  }

  if (!isRecord(info) || !isValidOathUpgrade(upgrade)) {
    throw new EquipmentSimulationFailure('request')
  }

  if (isSameUpgrade(upgrade, wornUpgrade(info))) {
    return null
  }

  return upgrade.map(({ step, option }) => ({ step, option }))
}

function wornOath(oath: CharacterPayload): CharacterPayload {
  const section = oath.oath

  if (!isRecord(section) || !Array.isArray(section.crystal)) {
    throw new EquipmentSimulationFailure('request')
  }

  return section
}

function setInfoSetId(section: CharacterPayload): number | null {
  const { setInfo } = section

  if (!isRecord(setInfo) || typeof setInfo.setId !== 'number') {
    return null
  }

  return setInfo.setId
}

function inferredSetId(
  section: CharacterPayload,
  crystals: readonly CharacterPayload[]
): number | null {
  const bodyItemId = wornItemId(section.info)
  const worn = crystals.map((crystal) => {
    const { tune } = crystal
    const setPoint = isRecord(tune) && typeof tune.setPoint === 'number' ? tune.setPoint : null
    const itemId = wornItemId(crystal)
    const tuneLevel = wornTuneLevel(crystal)

    return { itemId, tuneLevel, setPoint }
  })

  return inferOathSetId({ bodyItemId, crystals: worn })
}

/** 본체와 결정을 옮길 서약 세트이고, 원본과 같은 세트여도 다른 세트의 본체와 광휘 결정을 그 세트로 옮긴다. */
function checkedSet(worn: number | null, set: number | null): number | null {
  if (set === null) {
    return null
  }

  if (worn === null || !oathSets().some(({ setId }) => setId === set)) {
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
  setId: number | null,
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

  const choices =
    setId !== null ? [...oathVariantsOf(setId), ...oathVariantsOf(null)] : oathVariantsOf(family)
  const chosen = choices.find(({ id }) => id === body)

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

function simulatedBody(
  info: unknown,
  set: number | null,
  setId: number | null,
  body: string | null
) {
  const { worn, target } = bodyTarget(info, set, setId, body)

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

function emptyCrystals(
  crystals: readonly CharacterPayload[],
  changes: readonly OathCrystalChange[]
): CharacterPayload[] {
  return changes.flatMap(({ slotNo }) => {
    if (crystals.some((crystal) => crystal.slotNo === slotNo)) {
      return []
    }

    if (!Number.isInteger(slotNo) || slotNo < 0 || slotNo >= CRYSTAL_SLOTS) {
      throw new EquipmentSimulationFailure('request')
    }

    return [{ slotNo }]
  })
}

function bodyChoiceOf(id: string): { variant: OathVariant; setId: number | null } {
  const sets: (number | null)[] = [...oathSets().map(({ setId }) => setId), null]

  for (const setId of sets) {
    const variant = oathVariantsOf(setId).find((candidate) => candidate.id === id)

    if (variant !== undefined) {
      return { variant, setId }
    }
  }

  throw new EquipmentSimulationFailure('request')
}

/**
 * 원본에 서약이 없으면 고른 본체를 아이템 칸만으로 더하고, 결정은 고른 서약 세트(없으면 본체의 세트)의 선택지로 비어 있는 칸에 더한다.
 * 본체를 고르지 않은 요청, 서약 세트를 정할 수 없는 결정, 진의는 거절한다. 서약 세트는 엔진이 더한 본체와 결정으로 정한다.
 */
function addedOath(changes: OathChanges): OathEdit {
  if (changes.body === null || changes.upgrade !== null) {
    throw new EquipmentSimulationFailure('request')
  }

  const chosen = bodyChoiceOf(changes.body)
  const set = changes.set !== null ? checkedSet(changes.set, changes.set) : null
  const setId = set ?? chosen.setId
  const { itemId, itemName, itemRarity } = chosen.variant.item
  const crystals = emptyCrystals([], changes.crystals).flatMap((crystal) => {
    const change = changes.crystals.find(({ slotNo }) => slotNo === crystal.slotNo)
    const simulated = simulatedCrystal(crystal, change, null, setId)

    if (simulated === null) {
      return []
    }

    return [simulated]
  })

  if (primevalCount(crystals, crystals) > PRIMEVAL_OATH_CRYSTAL_LIMIT) {
    throw new EquipmentSimulationFailure('request')
  }

  return {
    set: null,
    body: { itemId, itemName, itemRarity },
    crystals,
    upgrade: null,
    changesItems: true,
    setInfoMissing: true,
    addsItems: true
  }
}

/**
 * 서약 세트를 옮긴 뒤 본체 등급과 결정의 등급, 조율을 바꾸고, 비어 있는 결정 칸에는 결정을 더한다. 서약이 없으면 본체부터 더한다.
 * 목록에 없는 세트나 선택지, 칸 밖의 슬롯, 조율 단계 밖의 조율과 태초 결정이 3개를 넘는 결정 교체는 거절한다.
 */
export function editOath(oath: CharacterPayload, changes: OathChanges): OathEdit {
  if (!hasChanges(changes)) {
    return noOathEdit
  }

  if (!isRecord(oath.oath)) {
    return addedOath(changes)
  }

  const section = wornOath(oath)
  const crystals = (section.crystal as unknown[]).filter(isRecord)
  const setInfoSet = setInfoSetId(section)
  // 응답에 세트가 없어도 게임은 세트 포인트 합이 가장 큰 세트의 효과를 적용한다.
  const worn = setInfoSet ?? inferredSetId(section, crystals)
  const set = checkedSet(worn, changes.set)
  const setId = set ?? worn
  // 엔진에는 서약 세트가 실제로 바뀔 때만 세트를 넣는다.
  const changedSet = set !== worn ? set : null

  const slots = [...crystals, ...emptyCrystals(crystals, changes.crystals)]
  const body = simulatedBody(section.info, set, setId, changes.body)
  const edited = slots.flatMap((crystal) => {
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

  const upgrade = changedUpgrade(section.info, changes.upgrade)
  const changesItems = changedSet !== null || body !== null || changesCrystals

  const setInfoMissing = setInfoSet === null
  const addsItems = edited.some(
    (crystal) => !crystals.some(({ slotNo }) => slotNo === crystal.slotNo)
  )

  return {
    set: changedSet,
    body,
    crystals: edited,
    upgrade,
    changesItems,
    setInfoMissing,
    addsItems
  }
}

export function hasOathEdit(edit: OathEdit): boolean {
  return (
    edit.set !== null || edit.body !== null || edit.crystals.length > 0 || edit.upgrade !== null
  )
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

  if (edit.upgrade !== null) {
    oath.upgrade = edit.upgrade
  }

  return oath
}

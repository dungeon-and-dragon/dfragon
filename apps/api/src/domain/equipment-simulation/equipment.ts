import {
  ENCHANT_GRADE_SLOTS,
  type EnchantEntry,
  type EnchantMembers,
  type EnchantGradeRole,
  type EnchantGradeSlot,
  chooseEnchantGrade,
  findEnchantOption,
  isEnchantMainStat,
  optionNeedsMainStat
} from '@dfragon/lib/enchant-grades'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import type { ScoreMainStat } from '@dfragon/server-core/domain/score/index.js'
import {
  type LabEnchantCardPrice,
  type LabEnchantSlot,
  findLabEnchantOption
} from '#domain/lab-enchant-options/index.js'
import { EquipmentSimulationFailure } from './failure.js'

const REINFORCE_LIMIT = 20
// 원본에 없는 부위로 더한 장비의 착용 품질은 알 수 없어 가장 많이 끼는 최상급으로 둔다.
export const ADDED_ITEM_GRADE = '최상급'
const AMPLIFICATION_PREFIX = '차원의 '

export interface EquipmentChange {
  readonly slotId: EnchantGradeSlot
  readonly reinforce: number
  readonly amplified: boolean
  /** null이면 착용한 장비의 마법부여를 그대로 둔다. */
  readonly enchantId: string | null
  /** 부위별 선택지 id(무기는 무기 종류의 선택지 id)이고, null이면 착용한 아이템을 그대로 둔다. */
  readonly variantId: string | null
  /** null이면 착용한 아이템의 조율 단계를 그대로 둔다. */
  readonly tune: number | null
  /** 유일 장비의 정밀도이고, null이면 그대로 둔다. */
  readonly potency: number | null
  /** 해방 계열 무기의 해방 수치이고, null이면 그대로 둔다. */
  readonly release: number | null
}

export interface EquipmentEdit {
  readonly original: CharacterPayload
  readonly reinforce: number
  readonly amplified: boolean
  /** 표시가 같은 마법부여 항목의 묶음이며, 항목은 주스탯을 안 뒤에 고른다. */
  readonly enchant: EnchantMembers<EnchantEntry> | null
}

export type LabEnchantSlots = readonly LabEnchantSlot<LabEnchantCardPrice>[]

function equippedItems(equipment: CharacterPayload): CharacterPayload[] {
  if (!Array.isArray(equipment.equipment)) {
    return []
  }

  return equipment.equipment.filter(isRecord)
}

// 버프 점수로 계산하는 버퍼만 버퍼 등급표를 쓰고, 나머지는 장비 점수로 계산하므로 딜러 등급표를 쓴다.
function enchantRole(role: CharacterRole | null): EnchantGradeRole {
  if (role === 'buffer') {
    return 'buffer'
  }

  return 'dealer'
}

function currentReinforce(item: CharacterPayload): number {
  if (typeof item.reinforce !== 'number') {
    return 0
  }

  return item.reinforce
}

function isAmplified(item: CharacterPayload): boolean {
  return typeof item.amplificationName === 'string'
}

// 등급표 id는 웹이 실험실 선택지로 바뀔 때까지 받는다.
function enchantOf(
  change: EquipmentChange,
  role: EnchantGradeRole,
  labOptions: LabEnchantSlots
): EnchantMembers<EnchantEntry> | null {
  if (change.enchantId === null) {
    return null
  }

  const option =
    findEnchantOption(change.slotId, role, change.enchantId) ??
    findLabEnchantOption(labOptions, change.slotId, role, change.enchantId)

  if (option === null) {
    throw new EquipmentSimulationFailure('request')
  }

  return option
}

export function changesEnchant(changes: readonly EquipmentChange[]): boolean {
  return changes.some(({ enchantId }) => enchantId !== null)
}

function isBareSlot(change: EquipmentChange): boolean {
  return change.reinforce === 0 && !change.amplified && change.enchantId === null
}

/**
 * 범위 밖 수치, 그 부위나 역할의 등급표와 실험실 선택지에 없는 마법부여는 거절한다. 비어 있는 부위는 `addedSlots`(이 요청이 장비를 더하는
 * 부위)일 때만 그 장비에 강화, 증폭, 마법부여를 싣고, 장비를 더하지 않는 빈 부위에 실으면 거절한다.
 */
export function editEquipment(
  equipment: CharacterPayload,
  changes: readonly EquipmentChange[],
  role: CharacterRole | null,
  addedSlots: ReadonlySet<string>,
  labOptions: LabEnchantSlots
): EquipmentEdit[] {
  const items = equippedItems(equipment)
  const gradeRole = enchantRole(role)

  return changes.flatMap((change) => {
    const worn = items.find((item) => item.slotId === change.slotId)

    if (worn === undefined && isBareSlot(change)) {
      return []
    }

    if (worn === undefined && !addedSlots.has(change.slotId)) {
      throw new EquipmentSimulationFailure('request')
    }

    const original = worn ?? { slotId: change.slotId }

    if (change.reinforce > Math.max(REINFORCE_LIMIT, currentReinforce(original))) {
      throw new EquipmentSimulationFailure('request')
    }

    const enchant = enchantOf(change, gradeRole, labOptions)

    return [{ original, reinforce: change.reinforce, amplified: change.amplified, enchant }]
  })
}

/** 강화한 장비를 증폭으로 바꾸거나, 마법부여가 주스탯에 따라 갈리는 묶음이면 주스탯이 있어야 한다. */
export function needsMainStat(edits: readonly EquipmentEdit[]): boolean {
  return edits.some(
    (edit) =>
      (edit.amplified && !isAmplified(edit.original)) ||
      (edit.enchant !== null && optionNeedsMainStat(edit.enchant))
  )
}

/**
 * 캐릭터가 고른 증폭 스탯을 따르도록, 시뮬레이터 부위에 착용한 원본 장비에서 가장 많이 쓴 증폭 이름의 스탯을 고른다.
 * 요청의 다른 변경에 따라 바뀌지 않게 원본만 세고, 동률이면 장비 응답에서 먼저 나온 이름이다.
 */
export function wornMainStat(equipment: CharacterPayload): ScoreMainStat | null {
  const slots: readonly unknown[] = ENCHANT_GRADE_SLOTS
  const counts = new Map<string, number>()

  for (const item of equippedItems(equipment)) {
    if (slots.includes(item.slotId) && typeof item.amplificationName === 'string') {
      counts.set(item.amplificationName, (counts.get(item.amplificationName) ?? 0) + 1)
    }
  }

  let chosen: string | null = null
  let chosenCount = 0

  for (const [name, count] of counts) {
    if (count > chosenCount) {
      chosen = name
      chosenCount = count
    }
  }

  if (chosen === null || !chosen.startsWith(AMPLIFICATION_PREFIX)) {
    return null
  }

  const stat = chosen.slice(AMPLIFICATION_PREFIX.length)

  if (!isEnchantMainStat(stat)) {
    return null
  }

  // 등급표의 주스탯과 엔진 결과의 주스탯이 같은 목록이어야 이 대입이 타입 검사를 통과한다.
  const mainStat: ScoreMainStat = stat

  return mainStat
}

function amplificationName(edit: EquipmentEdit, mainStat: ScoreMainStat | null): unknown {
  if (!edit.amplified) {
    return null
  }

  if (isAmplified(edit.original)) {
    return edit.original.amplificationName
  }

  if (mainStat === null) {
    throw new Error('Amplifying a reinforced item needs the main stat')
  }

  return `${AMPLIFICATION_PREFIX}${mainStat}`
}

// Neople 응답은 직업별 스킬 강화가 없는 마법부여에 reinforceSkill 키를 두지 않는다.
function toNeopleEnchant(grade: EnchantEntry): CharacterPayload {
  const status = structuredClone(grade.status)

  if (grade.reinforceSkill.length === 0) {
    return { status }
  }

  return { reinforceSkill: structuredClone(grade.reinforceSkill), status }
}

/** `mainStat`은 강화한 장비를 증폭으로 바꿀 이름과 묶인 마법부여 가운데 고를 항목을 정한다. */
export function simulatedEquipment(
  edits: readonly EquipmentEdit[],
  mainStat: ScoreMainStat | null
): CharacterPayload[] {
  return edits.map((edit) => {
    const item = structuredClone(edit.original)
    item.reinforce = edit.reinforce
    item.amplificationName = amplificationName(edit, mainStat)

    if (edit.enchant !== null) {
      item.enchant = toNeopleEnchant(chooseEnchantGrade(edit.enchant, mainStat))
    }

    return item
  })
}

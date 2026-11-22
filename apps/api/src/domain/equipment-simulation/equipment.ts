import {
  type EnchantGrade,
  type EnchantGradeRole,
  type EnchantGradeSlot,
  findEnchantGrade
} from '@dfragon/lib/enchant-grades'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayload } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import type { ScoreMainStat } from '@dfragon/server-core/domain/score/index.js'
import { EquipmentSimulationFailure } from './failure.js'

const REINFORCE_LIMIT = 20

export interface EquipmentChange {
  readonly slotId: EnchantGradeSlot
  readonly reinforce: number
  readonly amplified: boolean
  /** null이면 착용한 장비의 마법부여를 그대로 둔다. */
  readonly enchantId: string | null
}

export interface EquipmentEdit {
  readonly original: CharacterPayload
  readonly reinforce: number
  readonly amplified: boolean
  readonly enchant: EnchantGrade | null
}

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

function enchantOf(change: EquipmentChange, role: EnchantGradeRole): EnchantGrade | null {
  if (change.enchantId === null) {
    return null
  }

  const grade = findEnchantGrade(change.slotId, change.enchantId)

  if (grade === null || !grade.roles.includes(role)) {
    throw new EquipmentSimulationFailure('request')
  }

  return grade
}

/** 착용하지 않은 부위, 범위 밖 수치, 그 부위나 역할의 등급표에 없는 마법부여는 거절한다. */
export function editEquipment(
  equipment: CharacterPayload,
  changes: readonly EquipmentChange[],
  role: CharacterRole | null
): EquipmentEdit[] {
  const items = equippedItems(equipment)
  const gradeRole = enchantRole(role)

  return changes.map((change) => {
    const original = items.find((item) => item.slotId === change.slotId)

    if (original === undefined) {
      throw new EquipmentSimulationFailure('request')
    }

    if (change.reinforce > Math.max(REINFORCE_LIMIT, currentReinforce(original))) {
      throw new EquipmentSimulationFailure('request')
    }

    const enchant = enchantOf(change, gradeRole)

    return { original, reinforce: change.reinforce, amplified: change.amplified, enchant }
  })
}

/** 강화한 장비를 증폭으로 바꾸면 증폭 이름에 넣을 캐릭터의 주 스탯이 있어야 한다. */
export function needsMainStat(edits: readonly EquipmentEdit[]): boolean {
  return edits.some((edit) => edit.amplified && !isAmplified(edit.original))
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

  return `차원의 ${mainStat}`
}

// Neople 응답은 직업별 스킬 강화가 없는 마법부여에 reinforceSkill 키를 두지 않는다.
function toNeopleEnchant(grade: EnchantGrade): CharacterPayload {
  const status = structuredClone(grade.status)

  if (grade.reinforceSkill.length === 0) {
    return { status }
  }

  return { reinforceSkill: structuredClone(grade.reinforceSkill), status }
}

export function simulatedEquipment(
  edits: readonly EquipmentEdit[],
  mainStat: ScoreMainStat | null
): CharacterPayload[] {
  return edits.map((edit) => {
    const item = structuredClone(edit.original)
    item.reinforce = edit.reinforce
    item.amplificationName = amplificationName(edit, mainStat)

    if (edit.enchant !== null) {
      item.enchant = toNeopleEnchant(edit.enchant)
    }

    return item
  })
}

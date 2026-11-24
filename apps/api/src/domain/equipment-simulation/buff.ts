import {
  type BuffSwitching,
  buffSwitchingOf,
  isSelectableBuffLevel,
  isSelectableSwitchingEquipment
} from '@dfragon/lib/buff-switching'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import type { ScoreSimulationInput } from '@dfragon/server-core/domain/score/index.js'
import { EquipmentSimulationFailure } from './failure.js'

function switchingOf(
  payloads: CharacterPayloads,
  role: CharacterRole | null
): BuffSwitching | null {
  const { skill } = payloads.buff_equipment
  // 버프 점수로 계산하는 버퍼만 주 버프 레벨을 옮기고, 나머지는 장비 점수의 스위칭 항으로 계산한다.
  const switchingRole = role === 'buffer' ? 'buffer' : 'dealer'
  const buff = isRecord(skill) ? skill.buff : null

  return buffSwitchingOf({
    role: switchingRole,
    jobName: payloads.basic.jobName,
    buff,
    skillStyle: payloads.skill_style.skill
  })
}

/**
 * 버프 강화 스킬의 바꿀 레벨이고, 지금 레벨과 같으면 null이다.
 * 레벨을 바꿀 수 없는 캐릭터나 고를 수 있는 범위 밖의 레벨은 거절한다.
 */
export function editBuffLevel(
  payloads: CharacterPayloads,
  role: CharacterRole | null,
  level: number | null
): number | null {
  if (level === null) {
    return null
  }

  const switching = switchingOf(payloads, role)

  if (switching === null || !isSelectableBuffLevel(switching, level)) {
    throw new EquipmentSimulationFailure('request')
  }

  if (level === switching.level) {
    return null
  }

  return level
}

/**
 * 버프 강화 장비에 등록한 것으로 볼 유니크 스위칭 장비 수이고, 지금 등록한 수와 같으면 null이다.
 * 버퍼, 스위칭을 바꿀 수 없는 캐릭터, 범위 밖의 수는 거절한다.
 */
export function editSwitchingEquipment(
  payloads: CharacterPayloads,
  role: CharacterRole | null,
  count: number | null
): number | null {
  if (count === null) {
    return null
  }

  const switching = switchingOf(payloads, role)

  if (switching === null || !isSelectableSwitchingEquipment(switching, count)) {
    throw new EquipmentSimulationFailure('request')
  }

  if (count === switching.equipment?.count) {
    return null
  }

  return count
}

type SimulatedBuff = NonNullable<ScoreSimulationInput['buff']>

export function simulatedBuff(
  level: number | null,
  switchingEquipment: number | null
): SimulatedBuff | null {
  if (level === null && switchingEquipment === null) {
    return null
  }

  const buff: { -readonly [K in keyof SimulatedBuff]: SimulatedBuff[K] } = {}

  if (level !== null) {
    buff.level = level
  }

  if (switchingEquipment !== null) {
    buff.switchingEquipment = switchingEquipment
  }

  return buff
}

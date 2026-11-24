import {
  type BuffSwitching,
  type BuffSwitchingEquipment,
  buffSwitchingOf,
  isSelectableBuffLevel,
  isSelectableSwitchingEquipment
} from '@dfragon/lib/buff-switching'
import type { CharacterDetailView, EnchantRole } from '#entities/character'

type SwitchingDetail = Pick<CharacterDetailView, 'character' | 'buff' | 'skillStyle'>

/** null이면 버프 강화 스킬의 지금 레벨 그대로다. */
export type BuffLevelChange = number | null

/** null이면 버프 강화 장비에 지금 등록한 짙편린 수 그대로다. */
export type SwitchingEquipmentChange = number | null

export const SWITCHING_EQUIPMENT_COPY = {
  label: '짙편린',
  inputLabel: '짙편린 부위 수',
  count: (count: number) => `짙편린 ${count}부위`
} as const

export function toSimulatorSwitching(
  detail: SwitchingDetail,
  role: EnchantRole
): BuffSwitching | null {
  return buffSwitchingOf({
    role,
    jobName: detail.character.jobName,
    buff: detail.buff.equipment,
    skillStyle: detail.skillStyle
  })
}

export function buffLevelOf(switching: BuffSwitching, change: BuffLevelChange): number {
  if (change === null) {
    return switching.level
  }

  return change
}

export function changeBuffLevel(
  switching: BuffSwitching,
  change: BuffLevelChange,
  level: number
): BuffLevelChange {
  if (!isSelectableBuffLevel(switching, level)) {
    return change
  }

  if (level === switching.level) {
    return null
  }

  return level
}

export function switchingEquipmentOf(
  equipment: BuffSwitchingEquipment,
  change: SwitchingEquipmentChange
): number {
  if (change === null) {
    return equipment.count
  }

  return change
}

export function changeSwitchingEquipment(
  switching: BuffSwitching,
  change: SwitchingEquipmentChange,
  count: number
): SwitchingEquipmentChange {
  if (!isSelectableSwitchingEquipment(switching, count)) {
    return change
  }

  if (count === switching.equipment?.count) {
    return null
  }

  return count
}

export function switchingTextOf(
  switching: BuffSwitching,
  buffLevel: BuffLevelChange,
  switchingEquipment: SwitchingEquipmentChange
): string {
  const level = `${switching.skillName} ${buffLevelOf(switching, buffLevel)}레벨`

  if (switching.equipment === null) {
    return level
  }

  const count = switchingEquipmentOf(switching.equipment, switchingEquipment)

  return `${level}, ${SWITCHING_EQUIPMENT_COPY.count(count)}`
}

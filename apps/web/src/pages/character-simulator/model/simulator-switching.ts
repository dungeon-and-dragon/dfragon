import {
  type BuffSwitching,
  buffSwitchingOf,
  isSelectableBuffLevel
} from '@dfragon/lib/buff-switching'
import type { CharacterDetailView, EnchantRole } from '#entities/character'

type SwitchingDetail = Pick<CharacterDetailView, 'character' | 'buff' | 'skillStyle'>

/** null이면 버프 강화 스킬의 지금 레벨 그대로다. */
export type BuffLevelChange = number | null

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

import { buffSwitchingOf, isSelectableBuffLevel } from '@dfragon/lib/buff-switching'
import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { CharacterPayloads } from '@dfragon/server-core/domain/character-detail/index.js'
import type { CharacterRole } from '@dfragon/server-core/domain/character-role.js'
import { EquipmentSimulationFailure } from './failure.js'

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

  const { skill } = payloads.buff_equipment
  // 버프 점수로 계산하는 버퍼만 주 버프 레벨을 옮기고, 나머지는 장비 점수의 스위칭 항으로 계산한다.
  const switchingRole = role === 'buffer' ? 'buffer' : 'dealer'
  const buff = isRecord(skill) ? skill.buff : null
  const switching = buffSwitchingOf({
    role: switchingRole,
    jobName: payloads.basic.jobName,
    buff,
    skillStyle: payloads.skill_style.skill
  })

  if (switching === null || !isSelectableBuffLevel(switching, level)) {
    throw new EquipmentSimulationFailure('request')
  }

  if (level === switching.level) {
    return null
  }

  return level
}

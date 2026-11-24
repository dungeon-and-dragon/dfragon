import { isRecord } from './utils/shape-check.js'

export type BuffSwitchingRole = 'dealer' | 'buffer'

/** 버퍼 직업의 주 버프 스킬이다. 버프 강화에 이 스킬을 등록한 버퍼만 레벨을 바꿀 수 있다. */
export const BUFFER_MAIN_BUFF_SKILLS: Readonly<Record<string, string>> = {
  '프리스트(남)': '영광의 축복',
  '마법사(여)': '금단의 저주',
  '거너(여)': 'squad::무기강화();',
  아처: '러블리 템포',
  '프리스트(여)': '용맹의 축복'
}

// 운영 최대 관측 34레벨에서 이벤트, PC방으로 오르는 1레벨을 뺀 값이 상한이다.
export const BUFFER_BUFF_LEVELS = { min: 10, max: 33 } as const

// 딜러의 스위칭 항은 배운 레벨보다 10레벨 높을 때까지만 오른다.
export const DEALER_BUFF_LEVEL_SPAN = 10

/** level은 버프 강화 스킬의 지금 레벨이고, min~max 밖이어도 지금 레벨은 고를 수 있다. */
export interface BuffSwitching {
  readonly skillName: string
  readonly level: number
  readonly min: number
  readonly max: number
}

export interface BuffSwitchingSource {
  readonly role: BuffSwitchingRole
  readonly jobName: unknown
  /** Neople 버프 강화 장비 응답의 `skill.buff`(상세 응답의 `buff.equipment`)다. */
  readonly buff: unknown
  /** Neople 스킬 응답의 `skill`(상세 응답의 `skillStyle`)이다. */
  readonly skillStyle: unknown
}

interface BuffSkill {
  readonly skillId: string
  readonly name: string
  readonly level: number
}

function isLevel(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function buffSkillOf(buff: unknown): BuffSkill | null {
  if (!isRecord(buff) || !isRecord(buff.skillInfo)) {
    return null
  }

  const { skillId, name, option } = buff.skillInfo
  const level = isRecord(option) ? option.level : undefined

  if (typeof skillId !== 'string' || typeof name !== 'string' || !isLevel(level)) {
    return null
  }

  return { skillId, name, level }
}

function learnedLevelOf(skillStyle: unknown, skillId: string): number | null {
  if (!isRecord(skillStyle) || !isRecord(skillStyle.style)) {
    return null
  }

  const { active, passive } = skillStyle.style
  const skills = [active, passive].flatMap((list) => {
    if (!Array.isArray(list)) {
      return []
    }

    return list
  })
  const learned = skills.filter(isRecord).filter((skill) => skill.skillId === skillId)

  // 엔진도 같은 스킬을 정확히 한 번 찾을 때만 배운 레벨로 쓴다.
  if (learned.length !== 1) {
    return null
  }

  const [{ level }] = learned

  if (!isLevel(level)) {
    return null
  }

  return level
}

function rangeOf(
  source: BuffSwitchingSource,
  skill: BuffSkill
): { min: number; max: number } | null {
  if (source.role === 'buffer') {
    const mainBuff =
      typeof source.jobName === 'string' ? BUFFER_MAIN_BUFF_SKILLS[source.jobName] : undefined

    if (mainBuff !== skill.name) {
      return null
    }

    return BUFFER_BUFF_LEVELS
  }

  const learned = learnedLevelOf(source.skillStyle, skill.skillId)

  if (learned === null) {
    return null
  }

  return { min: learned, max: learned + DEALER_BUFF_LEVEL_SPAN }
}

/** 버프 강화 스킬의 레벨을 바꿀 수 없는 캐릭터(등록한 스킬이 없거나 버퍼의 주 버프가 아님)는 null이다. */
export function buffSwitchingOf(source: BuffSwitchingSource): BuffSwitching | null {
  const skill = buffSkillOf(source.buff)

  if (skill === null) {
    return null
  }

  const range = rangeOf(source, skill)

  if (range === null) {
    return null
  }

  return { skillName: skill.name, level: skill.level, ...range }
}

export function isSelectableBuffLevel(switching: BuffSwitching, level: number): boolean {
  if (level === switching.level) {
    return true
  }

  return isLevel(level) && level >= switching.min && level <= switching.max
}

/** 고를 수 있는 레벨을 오름차순으로 돌려준다. 범위 밖의 지금 레벨도 넣는다. */
export function selectableBuffLevels(switching: BuffSwitching): number[] {
  const levels = new Set([switching.level])

  for (let level = switching.min; level <= switching.max; level += 1) {
    levels.add(level)
  }

  return [...levels].sort((left, right) => left - right)
}

import { isRecord, textOrNull } from '@dfragon/lib/utils/shape-check'
import type { CharacterCard, CharacterRole } from './types.js'

export interface CharacterCardSource {
  character: Record<string, unknown>
  skillStyle: unknown
}

const awakeningPrefix = '眞'

const bufferJobs = new Set(['크루세이더', '인챈트리스', '패러메딕', '뮤즈'])

const crusader = '크루세이더'
const malePriest = '프리스트(남)'
const dealerCrusaderSkill = '용기의 은총'

function baseJobGrowName(jobGrowName: unknown): string | null {
  const name = textOrNull(jobGrowName)
  if (name === null) {
    return null
  }

  if (!name.startsWith(awakeningPrefix)) {
    return name
  }

  return name.slice(awakeningPrefix.length).trim()
}

function hasLearnedSkill(skillStyle: unknown, skillName: string): boolean {
  if (!isRecord(skillStyle) || !isRecord(skillStyle.style)) {
    return false
  }

  const { active, passive } = skillStyle.style

  return [active, passive].some(
    (skills) =>
      Array.isArray(skills) && skills.some((skill) => isRecord(skill) && skill.name === skillName)
  )
}

function characterRole({ character, skillStyle }: CharacterCardSource): CharacterRole | null {
  const job = baseJobGrowName(character.jobGrowName)
  if (job === null) {
    return null
  }

  // 남성 크루세이더는 스킬 구성으로 딜러와 버퍼를 바꾼다.
  const isDealerCrusader =
    job === crusader &&
    textOrNull(character.jobName) === malePriest &&
    hasLearnedSkill(skillStyle, dealerCrusaderSkill)
  if (isDealerCrusader) {
    return 'dealer'
  }

  if (bufferJobs.has(job)) {
    return 'buffer'
  }

  return 'dealer'
}

export function projectCharacterCard(details: CharacterCardSource): CharacterCard {
  const role = characterRole(details)

  return { role, stats: null, score: null, serverRank: null, set: null, oath: null, investment: [] }
}
